// 새 Apps Script URL로 검색 테스트
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyhrxDtxqBBV3jVLWC9knCPXxDxHPKrQXgv8P9tcIWi8VkB0_XfMe7l2tibSH45b4Lh/exec";

async function testSearch() {
    console.log("🔍 Testing search functionality...\n");

    // 1. 테스트 데이터 저장
    console.log("1️⃣ Saving test order...");
    const saveResponse = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            orders: [{
                recipient_name: "검색테스트",
                recipient_phone: "010-9999-8888",
                address: "서울시 테스트구 검색동 123",
                product_name: "테스트상품",
                option: "테스트옵션",
                quantity: 1,
                supply_price: 5000,
                shipping_fee: 3000
            }]
        }),
    });
    const saveResult = await saveResponse.text();
    console.log("Save result:", saveResult);

    // 2. 이름으로 검색
    console.log("\n2️⃣ Searching by name '검색테스트'...");
    const searchByName = await fetch(`${APPS_SCRIPT_URL}?name=검색테스트`);
    const nameResult = await searchByName.json();
    console.log("Search by name result:", JSON.stringify(nameResult, null, 2));

    // 3. 전화번호로 검색
    console.log("\n3️⃣ Searching by phone '010-9999-8888'...");
    const searchByPhone = await fetch(`${APPS_SCRIPT_URL}?phone=010-9999-8888`);
    const phoneResult = await searchByPhone.json();
    console.log("Search by phone result:", JSON.stringify(phoneResult, null, 2));

    // 4. 이름 + 전화번호로 검색
    console.log("\n4️⃣ Searching by both name and phone...");
    const searchBoth = await fetch(`${APPS_SCRIPT_URL}?name=검색테스트&phone=010-9999-8888`);
    const bothResult = await searchBoth.json();
    console.log("Search by both result:", JSON.stringify(bothResult, null, 2));

    console.log("\n✅ Test complete!");
}

testSearch();
