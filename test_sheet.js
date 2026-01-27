
const CONFIG = {
    SPREADSHEET_ID: "141RCJ5K5P9CdhpW60ojMFSPV7mR6CPRz",
    TARGET_GID: "809784246",
};

async function testFetch() {
    const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/export?format=csv&gid=${CONFIG.TARGET_GID}`;
    console.log("Fetching URL:", url);
    try {
        const res = await fetch(url);
        if (res.ok) {
            const text = await res.text();
            console.log("Success! Content length:", text.length);
            console.log("First line:", text.split("\n")[0]);
        } else {
            console.log("Failed:", res.status, res.statusText);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

testFetch();
