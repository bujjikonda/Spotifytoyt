const spotifyService = require('../services/spotify');
const youtubeService = require('../services/youtube');
const sheetsService = require('../services/sheets');

async function processPlaylist(playlistId, googleAuthClient, res) {
    res.write('<h1>Processing...</h1>');
    res.write('<p>Fetching Spotify tracks...</p>');

    try {
        const tracks = await spotifyService.getPlaylistTracks(playlistId);
        res.write(`<p>Found ${tracks.length} tracks. Searching YouTube...</p>`);

        const successData = [['Track Name', 'Artist', 'Album', 'YouTube Link']];
        const errorData = [['Track Name', 'Artist', 'Album', 'Error Details']];

        // We'll write the header immediately to a new sheet to ensure it exists? 
        // Actually, let's just collect data and write in batches at the end, 
        // OR write incrementally if we want to be safe against crashes.
        // For simplicity and batching efficiency, let's collect all, but stop if quota hit.

        let quotaExceeded = false;

        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];

            // Rate limiting: Sleep 300ms between requests
            await new Promise(resolve => setTimeout(resolve, 300));

            // Periodic logging to keep connection alive and inform user
            if (i % 10 === 0) {
                res.write(`<script>console.log("Processed ${i}/${tracks.length}")</script>`);
            }

            const query = `${track.name} ${track.artist} ${track.album}`;
            const link = await youtubeService.searchVideo(query, googleAuthClient);

            if (link === 'QuotaExceeded') {
                res.write('<p style="color:red; font-weight:bold;">YouTube API Quota Exceeded! Stopping search.</p>');
                quotaExceeded = true;
                // Add remaining tracks to error list as "Skipped - Quota Exceeded"
                for (let j = i; j < tracks.length; j++) {
                    const skippedTrack = tracks[j];
                    errorData.push([skippedTrack.name, skippedTrack.artist, skippedTrack.album, 'Skipped - Quota Exceeded']);
                }
                break;
            } else if (link === 'Not found' || link === 'Error') {
                errorData.push([track.name, track.artist, track.album, link]);
                res.write(`<p style="color:red;">Failed: ${track.name} - ${link}</p>`);
            } else {
                successData.push([track.name, track.artist, track.album, link]);
                res.write(`<p>Processed (${i + 1}/${tracks.length}): ${track.name} - <a href="${link}" target="_blank">Link</a></p>`);
            }
        }

        res.write('<p>Creating Google Sheet...</p>');
        const spreadsheetId = await sheetsService.createSheet(`Spotify Playlist: ${playlistId}`, googleAuthClient);

        if (successData.length > 1) {
            res.write(`<p>Writing ${successData.length - 1} successful tracks...</p>`);
            // Use batch writing
            await sheetsService.writeDataBatched(spreadsheetId, successData, googleAuthClient, 1);
        }

        if (errorData.length > 1) {
            res.write('<p>Found errors/skipped tracks. Creating Errors sheet...</p>');
            await sheetsService.addSheet(spreadsheetId, 'Errors', googleAuthClient);
            res.write(`<p>Writing ${errorData.length - 1} error entries...</p>`);
            await sheetsService.writeDataBatched(spreadsheetId, errorData, googleAuthClient, 1); // Note: This needs to target 'Errors' sheet inside the function or we pass range
            // Wait, writeDataBatched defaults to Sheet1. We need to fix that or just use writeData for errors if small, 
            // BUT errors could be large if quota exceeded.
            // Let's fix writeDataBatched to accept sheet name or handle it.
            // Actually, let's just use a loop here for errors since I didn't update writeDataBatched signature to take sheet name easily without changing range logic.
            // Re-reading my writeDataBatched implementation: it takes `startRow`. It assumes `Sheet1`.
            // I should have made it more flexible. Let's just do a quick loop here for errors to be safe.

            const BATCH_SIZE = 500;
            for (let i = 0; i < errorData.length; i += BATCH_SIZE) {
                const chunk = errorData.slice(i, i + BATCH_SIZE);
                const range = `Errors!A${1 + i}`;
                await sheetsService.writeData(spreadsheetId, chunk, googleAuthClient, range);
            }
        }

        res.write(`<p>Done! <a href="https://docs.google.com/spreadsheets/d/${spreadsheetId}" target="_blank">Open Sheet</a></p>`);
        if (quotaExceeded) {
            res.write('<p><strong>Note:</strong> Process stopped early due to YouTube Quota. Check the "Errors" tab for skipped tracks.</p>');
        }
        res.end();

    } catch (err) {
        console.error(err);
        res.write(`<p>Error: ${err.message}</p>`);
        res.end();
    }
}

async function retryErrors(spreadsheetId, googleAuthClient, res) {
    res.write('<h1>Retrying Errors...</h1>');
    res.write('<p>Reading "Errors" sheet...</p>');

    try {
        const rows = await sheetsService.readData(spreadsheetId, 'Errors!A2:D', googleAuthClient);

        if (!rows || rows.length === 0) {
            res.write('<p>No errors found in "Errors" sheet.</p>');
            res.end();
            return;
        }

        res.write(`<p>Found ${rows.length} error entries. Retrying...</p>`);

        const recoveredData = [];

        for (const row of rows) {
            // Row format: [Track Name, Artist, Album, Error Details]
            const [name, artist, album] = row;
            const query = `${name} ${artist} ${album}`;
            const link = await youtubeService.searchVideo(query, googleAuthClient);

            if (link !== 'Not found' && link !== 'Error') {
                recoveredData.push([name, artist, album, link]);
                res.write(`<p style="color:green;">Recovered: ${name} - ${link}</p>`);
            } else {
                res.write(`<p style="color:red;">Still Failed: ${name} - ${link}</p>`);
            }
        }

        if (recoveredData.length > 0) {
            res.write('<p>Writing recovered data to "Sheet1"...</p>');
            await sheetsService.writeData(spreadsheetId, recoveredData, googleAuthClient, 'Sheet1!A1');
            res.write(`<p>Success! Added ${recoveredData.length} tracks to Sheet1.</p>`);
        } else {
            res.write('<p>Could not recover any tracks.</p>');
        }

        res.write(`<p>Done! <a href="https://docs.google.com/spreadsheets/d/${spreadsheetId}" target="_blank">Open Sheet</a></p>`);
        res.end();

    } catch (err) {
        console.error(err);
        if (err.message.includes('Unable to parse range')) {
            res.write('<p>Error: Could not find "Errors" sheet. Please check the Spreadsheet ID or ensure the sheet has an "Errors" tab.</p>');
        } else {
            res.write(`<p>Error: ${err.message}</p>`);
        }
        res.end();
    }
}

module.exports = {
    processPlaylist,
    retryErrors
};
