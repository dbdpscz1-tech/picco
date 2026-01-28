/**
 * 피코 개별주문 저장 Google Apps Script
 * 
 * 사용법:
 * 1. Google Apps Script (https://script.google.com) 에서 새 프로젝트 생성
 * 2. 이 코드를 붙여넣기
 * 3. 배포 > 새 배포 > 웹 앱 선택
 * 4. 실행할 사용자: 본인, 액세스 권한: 모든 사용자
 * 5. 배포 후 URL을 config.ts의 APPS_SCRIPT_URL에 업데이트
 */

// 스프레드시트 ID (config.ts의 SPREADSHEET_ID와 동일해야 함)
const SPREADSHEET_ID = "1aN2RI_hF0Nq6sfPm5yH3_thYmFKuY3CAgnMIaCEB6yk";
const SHEET_NAME = "피코 개별주문 시트"; // 정확한 시트 이름

// POST 요청 처리 (주문 저장)
function doPost(e) {
  try {
    // CORS 헤더 설정
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // 요청 본문 파싱
    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return createJsonResponse({ success: false, error: "Invalid JSON: " + parseError.message }, headers);
    }

    const orders = data.orders;
    
    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return createJsonResponse({ success: false, error: "No orders provided" }, headers);
    }

    // 스프레드시트 열기
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // 시트 이름으로 찾기
    let sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return createJsonResponse({ 
        success: false, 
        error: "시트를 찾을 수 없음: " + SHEET_NAME + ". 사용 가능한 시트: " + ss.getSheets().map(s => s.getName()).join(", ")
      }, headers);
    }

    // 현재 한국 시간
    const now = new Date();
    const koreaTime = Utilities.formatDate(now, "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
    
    let savedCount = 0;
    
    // 각 주문을 시트에 추가
    for (const order of orders) {
      const total = (order.supply_price * order.quantity) + order.shipping_fee;
      
      // A: 저장시간, B: 수취인명, C: 전화번호, D: 주소, E: 상품명, F: 옵션, G: 수량, H: 공급가, I: 택배비, J: 합계
      const row = [
        koreaTime,           // A: 저장시간
        order.recipient_name,  // B: 수취인명
        order.recipient_phone, // C: 전화번호
        order.address,         // D: 주소
        order.product_name,    // E: 상품명
        order.option,          // F: 옵션
        order.quantity,        // G: 수량
        order.supply_price,    // H: 공급가
        order.shipping_fee,    // I: 택배비
        total                  // J: 합계
      ];
      
      sheet.appendRow(row);
      savedCount++;
    }

    return createJsonResponse({ 
      success: true, 
      count: savedCount,
      message: savedCount + "건 저장 완료"
    }, headers);
    
  } catch (error) {
    return createJsonResponse({ 
      success: false, 
      error: error.toString() 
    }, {});
  }
}

// GET 요청 처리 (주문 조회 - 검색 지원)
function doGet(e) {
  try {
    const headers = {
      "Access-Control-Allow-Origin": "*",
    };

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return createJsonResponse({ 
        success: false, 
        error: "시트를 찾을 수 없음: " + SHEET_NAME 
      }, headers);
    }

    const data = sheet.getDataRange().getValues();
    
    // 첫 번째 행은 헤더
    if (data.length <= 1) {
      return createJsonResponse({ success: true, orders: [], count: 0 }, headers);
    }

    // 검색 파라미터 확인
    const searchName = e.parameter.name || "";
    const searchPhone = e.parameter.phone || "";
    const searchMode = searchName || searchPhone; // 검색 모드 여부
    
    const now = new Date();
    const koreaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    
    // 오늘 11시 기준점 계산 (검색 모드가 아닐 때만 사용)
    let cutoffTime = new Date(koreaTime);
    cutoffTime.setHours(11, 0, 0, 0);
    
    if (koreaTime < cutoffTime) {
      cutoffTime.setDate(cutoffTime.getDate() - 1);
    }
    
    // 데이터 필터링
    const orders = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const savedTimeStr = row[0];
      const rowName = String(row[1] || "").trim();
      const rowPhone = String(row[2] || "").trim();
      
      if (!savedTimeStr) continue;
      
      let savedTime;
      if (savedTimeStr instanceof Date) {
        savedTime = savedTimeStr;
      } else {
        savedTime = new Date(savedTimeStr);
      }
      
      let shouldInclude = false;
      
      if (searchMode) {
        // 검색 모드: 이름과 전화번호로 필터링 (둘 다 일치해야 함)
        const nameMatch = !searchName || rowName.includes(searchName);
        const phoneMatch = !searchPhone || rowPhone.includes(searchPhone);
        shouldInclude = nameMatch && phoneMatch;
      } else {
        // 기본 모드: 11시 기준 필터링
        shouldInclude = savedTime >= cutoffTime;
      }
      
      if (shouldInclude) {
        orders.push({
          saved_time: Utilities.formatDate(savedTime, "Asia/Seoul", "yyyy-MM-dd HH:mm:ss"),
          recipient_name: row[1] || "",
          recipient_phone: row[2] || "",
          address: row[3] || "",
          product_name: row[4] || "",
          option: row[5] || "",
          quantity: row[6] || 0,
          supply_price: row[7] || 0,
          shipping_fee: row[8] || 0,
          total: row[9] || 0
        });
      }
    }

    return createJsonResponse({ 
      success: true, 
      orders: orders,
      count: orders.length,
      searchMode: searchMode ? true : false
    }, headers);
    
  } catch (error) {
    return createJsonResponse({ 
      success: false, 
      error: error.toString() 
    }, {});
  }
}

// OPTIONS 요청 처리 (CORS preflight)
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
}

// JSON 응답 생성 헬퍼
function createJsonResponse(data, headers) {
  const output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// 테스트 함수 (스크립트 에디터에서 직접 실행 가능)
function testPost() {
  const testEvent = {
    postData: {
      contents: JSON.stringify({
        orders: [{
          recipient_name: "테스트",
          recipient_phone: "010-1234-5678",
          address: "서울시 테스트구 테스트동 123",
          product_name: "테스트 상품",
          option: "테스트 옵션",
          quantity: 1,
          supply_price: 10000,
          shipping_fee: 3000
        }]
      })
    }
  };
  
  const result = doPost(testEvent);
  Logger.log(result.getContent());
}
