// 새 Apps Script URL로 테스트
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwBxr_W9LJpxihqbqP5dktKCxQKtOI_W0j4rx4UJ_wpq1Ri40LEfXUVi5PJPFF5KdoJ/exec";

async function testAppsScript() {
    console.log("🚀 Sending test POST to NEW Apps Script...");
    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                orders: [
                    {
                        recipient_name: "테스트고객",
                        recipient_phone: "010-1234-5678",
                        address: "서울시 강남구 테스트로 123",
                        product_name: "테스트상품",
                        option: "테스트옵션",
                        quantity: 1,
                        supply_price: 10000,
                        shipping_fee: 3000
                    }
                ]
            }),
        });

        console.log("Status:", response.status);
        const text = await response.text();
        console.log("Response:", text);

        // JSON 파싱 시도
        try {
            const json = JSON.parse(text);
            if (json.success) {
                console.log("✅ SUCCESS! Saved", json.count, "orders");
            } else {
                console.log("❌ FAILED:", json.error);
            }
        } catch (e) {
            // JSON이 아니면 그냥 텍스트 출력
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

testAppsScript();
