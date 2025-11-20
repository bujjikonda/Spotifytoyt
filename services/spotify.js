const SpotifyWebApi = require('spotify-web-api-node');

const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

const scopes = ['playlist-read-private', 'playlist-read-collaborative'];

function getAuthUrl() {
    return spotifyApi.createAuthorizeURL(scopes);
}

async function setAccessToken(code) {
    const data = await spotifyApi.authorizationCodeGrant(code);
    spotifyApi.setAccessToken(data.body['access_token']);
    spotifyApi.setRefreshToken(data.body['refresh_token']);
    return data.body;
}

async function getPlaylistTracks(playlistId) {
    let tracks = [];
    let offset = 0;
    let limit = 100;
    let hasMore = true;

    try {
        while (hasMore) {
            let data;
            try {
                data = await spotifyApi.getPlaylistTracks(playlistId, { offset, limit });
            } catch (err) {
                if (err.statusCode === 401) {
                    console.log('Access token expired, refreshing...');
                    const refreshData = await spotifyApi.refreshAccessToken();
                    spotifyApi.setAccessToken(refreshData.body['access_token']);
                    // Retry the request
                    data = await spotifyApi.getPlaylistTracks(playlistId, { offset, limit });
                } else {
                    throw err;
                }
            }

            const items = data.body.items;

            items.forEach(item => {
                if (item.track) {
                    tracks.push({
                        name: item.track.name,
                        artist: item.track.artists.map(a => a.name).join(', '),
                        album: item.track.album.name
                    });
                }
            });

            if (items.length < limit) {
                hasMore = false;
            } else {
                offset += limit;
            }
        }
        return tracks;
    } catch (error) {
        console.error('Error getting playlist tracks:', error);
        throw error;
    }
}

module.exports = {
    getAuthUrl,
    setAccessToken,
    getPlaylistTracks
};
