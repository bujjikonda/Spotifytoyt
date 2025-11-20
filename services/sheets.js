const { google } = require('googleapis');

const sheets = google.sheets('v4');

async function createSheet(title, auth) {
    const resource = {
        properties: {
            title: title,
        },
    };
    const res = await sheets.spreadsheets.create({
        auth: auth,
        resource,
        fields: 'spreadsheetId',
    });
    return res.data.spreadsheetId;
}

async function addSheet(spreadsheetId, title, auth) {
    const resource = {
        requests: [
            {
                addSheet: {
                    properties: {
                        title: title,
                    },
                },
            },
        ],
    };
    await sheets.spreadsheets.batchUpdate({
        auth: auth,
        spreadsheetId,
        resource,
    });
}

async function writeData(spreadsheetId, data, auth, range = 'Sheet1!A1') {
    // data is an array of arrays, e.g. [['Name', 'Artist', 'Link'], ['Song1', 'Artist1', 'Link1']]
    const resource = {
        values: data,
    };
    await sheets.spreadsheets.values.append({
        auth: auth,
        spreadsheetId,
        range: range,
        valueInputOption: 'RAW',
        resource,
    });
}

async function writeDataBatched(spreadsheetId, data, auth, startRow = 1) {
    const BATCH_SIZE = 500;
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const chunk = data.slice(i, i + BATCH_SIZE);
        const range = `Sheet1!A${startRow + i}`;
        await writeData(spreadsheetId, chunk, auth, range);
        console.log(`Wrote batch ${i} to ${i + chunk.length}`);
    }
}

async function readData(spreadsheetId, range, auth) {
    const res = await sheets.spreadsheets.values.get({
        auth: auth,
        spreadsheetId,
        range,
    });
    return res.data.values;
}

module.exports = {
    createSheet,
    addSheet,
    writeData,
    writeDataBatched,
    readData
};
