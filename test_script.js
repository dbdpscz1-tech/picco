// Using built-in fetch
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzFhw9IG_3aHpGCva2kc2KmNxsufgH0xc3ZZxSDk_L93JT5HFtAlGK-MIHHnt3r9oeO/exec";

async function testAppsScript() {
    console.log("Sending test POST to Apps Script...");
    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            // Sending a dummy order to see if it accepts it or returns an error
            body: JSON.stringify({
                orders: [
                    {
                        recipient_name: "테스트",
                        recipient_phone: "010-0000-0000",
                        address: "테스트 주소",
                        product_name: "테스트 상품",
                        option: "테스트 옵션",
                        quantity: 1,
                        supply_price: 1000,
                        shipping_fee: 2500,
                        sheet_id: "809784246" // Trying to pass the GID
                    }
                ]
            }),
        });

        console.log("Status:", response.status);
        const text = await response.text();
        console.log("Response:", text);
    } catch (e) {
        console.error("Error:", e);
    }
}

testAppsScript();
