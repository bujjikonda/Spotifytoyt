const appController = require('../controllers/appController');
const spotifyService = require('../services/spotify');
const youtubeService = require('../services/youtube');
const sheetsService = require('../services/sheets');

// Mock services
spotifyService.getPlaylistTracks = async (id) => {
    console.log(`[Mock] Fetching tracks for playlist ${id}`);
    return [
        { name: 'Song1', artist: 'Artist1', album: 'Album1' },
        { name: 'Song2', artist: 'Artist2', album: 'Album2' }
    ];
};

youtubeService.searchVideo = async (query, auth) => {
    console.log(`[Mock] Searching video for: ${query}`);
    if (query.includes('Song2')) return 'Not found';
    return 'https://youtube.com/watch?v=123';
};

sheetsService.createSheet = async (title, auth) => {
    console.log(`[Mock] Creating sheet: ${title}`);
    return 'mock_spreadsheet_id';
};

sheetsService.writeData = async (id, data, auth, range) => {
    console.log(`[Mock] Writing data to ${id} at ${range}: ${data.length} rows`);
};

sheetsService.addSheet = async (id, title, auth) => {
    console.log(`[Mock] Adding sheet: ${title} to ${id}`);
};

sheetsService.readData = async (id, range, auth) => {
    console.log(`[Mock] Reading data from ${id} at ${range}`);
    return [
        ['Song2', 'Artist2', 'Album2', 'Not found']
    ];
};

// Mock Response object
const res = {
    write: (msg) => console.log(`[Res] ${msg}`),
    end: () => console.log('[Res] Done')
};

async function runTests() {
    console.log('--- Testing Process Playlist ---');
    await appController.processPlaylist('test_playlist_id', {}, res);

    console.log('\n--- Testing Retry Errors ---');
    // Mock searchVideo to succeed this time
    youtubeService.searchVideo = async (query, auth) => {
        console.log(`[Mock] Searching video for: ${query}`);
        return 'https://youtube.com/watch?v=456';
    };
    await appController.retryErrors('mock_spreadsheet_id', {}, res);
}

runTests().catch(console.error);
