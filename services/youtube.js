const { google } = require('googleapis');

const youtube = google.youtube('v3');

async function searchVideo(query, auth) {
    try {
        const res = await youtube.search.list({
            auth: auth,
            part: 'snippet',
            q: query,
            maxResults: 1,
            type: 'video'
        });

        if (res.data.items.length > 0) {
            const videoId = res.data.items[0].id.videoId;
            return `https://www.youtube.com/watch?v=${videoId}`;
        } else {
            return 'Not found';
        }
    } catch (error) {
        if (error.code === 403 && error.errors && error.errors[0].reason === 'quotaExceeded') {
            console.error('YouTube Quota Exceeded');
            return 'QuotaExceeded';
        }
        console.error('Error searching YouTube:', error);
        return 'Error';
    }
}

module.exports = {
    searchVideo
};
