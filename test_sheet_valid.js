// 수정된 스프레드시트 ID로 테스트
const CONFIG = {
    SPREADSHEET_ID: "1aN2RI_hF0Nq6sfPm5yH3_thYmFKuY3CAgnMIaCEB6yk",
    TARGET_GID: "809784246",  // 피코 개별주문 시트
};

async function testFetch() {
    const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SPREADSHEET_ID}/export?format=csv&gid=${CONFIG.TARGET_GID}`;
    console.log("Fetching URL:", url);
    try {
        const res = await fetch(url);
        if (res.ok) {
            const text = await res.text();
            console.log("✅ Success! Content length:", text.length);
            console.log("First 500 chars:", text.substring(0, 500));
        } else {
            console.log("❌ Failed:", res.status, res.statusText);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

testFetch();
