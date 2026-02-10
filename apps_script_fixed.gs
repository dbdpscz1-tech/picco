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

// POST 요청 처리 (주문 저장 및 상태 업데이트)
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

    // action 필드로 구분: "update_status"면 상태 업데이트, 아니면 주문 저장
    if (data.action === "update_status") {
      return updateOrderStatus(data, headers);
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
      // K: 주문자명, L: 주문자 전화번호, M: 상태
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
        total,                 // J: 합계
        order.orderer_name || order.recipient_name || "",  // K: 주문자명
        order.orderer_phone || order.recipient_phone || "", // L: 주문자 전화번호
        "대기"                  // M: 상태 (기본값: 대기)
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
        // 기본 모드: M 칼럼 기반 필터링만 적용 (시간 기준 없음)
        // 상태 필드 확인 (M 컬럼, 인덱스 12)
        const status = row[12] || "";
        
        // '발주완료'가 아닌 항목만 포함 (비어있는 항목 포함)
        if (status === "발주완료") {
          continue;
        }
        
        shouldInclude = true;
      }
      
      if (shouldInclude) {
        // 검색 모드일 때는 상태 필터링 없이 모든 주문 반환
        if (searchMode) {
          // 검색 모드에서는 상태 필터링 없음
        } else {
          // 기본 모드에서는 이미 위에서 필터링됨
        }
        
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
          total: row[9] || 0,
          orderer_name: row[10] || "",      // K: 주문자명
          orderer_phone: row[11] || "",     // L: 주문자 전화번호
          status: status                    // M: 상태
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

// 주문 상태 업데이트 함수
function updateOrderStatus(data, headers) {
  try {
    const orderIds = data.order_ids; // 주문 ID 배열 (saved_time 문자열 배열)
    const newStatus = data.status || "완료";

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return createJsonResponse({ success: false, error: "No order IDs provided" }, headers);
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      return createJsonResponse({ 
        success: false, 
        error: "시트를 찾을 수 없음: " + SHEET_NAME 
      }, headers);
    }

    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    // 헤더 행이 있으므로 인덱스는 1부터 시작
    let updatedCount = 0;
    
    // saved_time을 기준으로 주문 찾기
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const savedTimeStr = row[0];
      
      // saved_time을 문자열로 변환하여 비교
      let savedTimeStrFormatted = "";
      if (savedTimeStr instanceof Date) {
        savedTimeStrFormatted = Utilities.formatDate(savedTimeStr, "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
      } else {
        savedTimeStrFormatted = String(savedTimeStr);
      }
      
      // 주문 ID는 saved_time 문자열로 매칭
      if (orderIds.includes(savedTimeStrFormatted)) {
        // M 컬럼 (인덱스 12)에 상태 업데이트
        sheet.getRange(i + 1, 13).setValue(newStatus); // M 컬럼 = 13번째 열
        updatedCount++;
      }
    }

    return createJsonResponse({ 
      success: true, 
      count: updatedCount,
      message: updatedCount + "건의 상태가 '" + newStatus + "'로 업데이트되었습니다"
    }, headers);
    
  } catch (error) {
    return createJsonResponse({ 
      success: false, 
      error: error.toString() 
    }, headers);
  }
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
          shipping_fee: 3000,
          orderer_name: "테스트 주문자",
          orderer_phone: "010-1234-5678"
        }]
      })
    }
  };
  
  const result = doPost(testEvent);
  Logger.log(result.getContent());
}
