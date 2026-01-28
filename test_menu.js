// 기존 스프레드시트 ID로 메뉴판 테스트
const oldId = '141RCJ5K5P9CdhpW60ojMFSPV7mR6CPRz';
const url = `https://docs.google.com/spreadsheets/d/${oldId}/export?format=csv&gid=202191104`;
console.log('기존 스프레드시트에서 메뉴판 테스트...');
fetch(url).then(r => r.text()).then(t => {
    if (t.startsWith('<!DOCTYPE')) {
        console.log('❌ 기존 스프레드시트에도 없거나 접근 불가');
    } else {
        console.log('✅ 기존 스프레드시트에서 메뉴판 발견!');
        console.log('First 300 chars:', t.substring(0, 300));
    }
}).catch(e => console.error('Error:', e));
