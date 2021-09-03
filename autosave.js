/** 
 * @author      : kjk
 * @date        : 2021-08-27
 * @description : 자동저장
 * @version  : 1.0000 버전 최초작성. api 자동저장 저장함수호출, 자동저장 로드함수 호출, 저장데이터 contentExtra 입력
 * @version  : 1.0002 콜백함수 분리
 * @version  : 1.0003 alert confirm을 custom modal 로 변경 
 * @version  : 1.0004 modal confirm callback 함수로 호출할 수 있도록 분리
 * @version  : 1.0005 페이지 변경
 */  
'use strict';

/**
 * 2021-08-17 kjk
 * 자동완성 namespace
 */
var Autosave = Autosave || {};
/**
 * 자동저장 인터벌 콜백함수
 *
 * @var {json}
 */
Autosave.setIntervalCallback = {};

Autosave.loaded = false; // 자동저장 불러올 시 플래그값 true

 /**
  * 자동저장 설정값
  *
  * @var {json}
  */
Autosave.settings = {
    boTable : "", // 테이블명
    boTableType : "", // 테이블에 구분이 필요하다면
    updateAutosaveUrl: "/apis/index.php/BoardNew/updateAutosave", // 자동저장 데이터 저장 url
    getAutosaveUrl: "/apis/index.php/BoardNew/getAutosave", // 자동저장 데이터 로드 url
    clickEventElement: ".regist_container", // 자동저장 이벤트 발생 element
    token : typeof token !== "undefined" ? token : "", // api 토큰
    autosaveInterval : 3000, // 자동저장 주기(1초)
    autosaveTimeoutCheckerInterval : 10000, // 자동저장 타임아웃 주기(1초)
    uploadingCnt : 0,  // 업로드 횟수
    currentUploadingCnt : 0, // 현재 업로드 횟수
    writeOptionsChanged : false, // 업로드 가능한지
    writeOptionsChangedOutdated : false, // 변경내역이 타임아웃 기간동안 존재하지 않는 경우 interval 제거
    autosaveCallIntervalCallback : "",
    autosaveCallIntervalTimeoutCheckerCallback : ""
}

/**
 * 로딩이미지 켜고 끄기
 * 
 * @date 2021-08-17
 * @author kjk
 * 
 * @param {enum} type  on, off 켤지 끌지
 * @param {jQuery.element} element 타겟
 * @return {void}
 */
Autosave.loadingAni = function(type, element) {
    return typeof loading_ani === "undefined" ? false : loading_ani(type, element);
}


/**
 * 자동저장 데이터를 불러온다
 * 
 * @date 2021-08-17
 * @author kjk
 * 
 * @param {json} options 
 * @return {void}
 */
Autosave.getAutosave = function() {
    var _this = this;
    const sendJsonData = {
        boTable : _this.settings.boTable,
        type : _this.settings.boTableType,
    }
    return new Promise(function(resolve, reject) {
        $.ajax({
            type: "GET",
            url: _this.settings.getAutosaveUrl,
            data: sendJsonData,
            beforeSend: function (xhr) {
                xhr.setRequestHeader('Web-Token', _this.settings.token);
            },
            success: function (res) {
                console.log(res);
                // api 요청 실패시
                if(typeof res === "undefined" || typeof res.status === "undefined" || res === false) {
                    if(typeof getAlertPop !== "undefined") {
                        getAlertPop.alert.showAlert("임시저장 정보를 불러오는데 실패했습니다.");
                    } else {
                        alert("임시저장 정보를 불러오는데 실패했습니다.");
                    }
                    typeof loading_ani !== "undefined" && loading_ani("off"); // 로딩창 제거
                    resolve();
                    return 0;
                }

                // api 데이터없음 exception 처리
                if(typeof res.result === "undefined" || typeof res.result.data === "undefined") {
                    if(typeof getAlertPop !== "undefined") {
                        getAlertPop.alert.showAlert("임시저장 정보를 불러오는데 실패했습니다.");
                    } else {
                        alert("임시저장 정보를 불러오는데 실패했습니다.");
                    }
                    typeof loading_ani !== "undefined" && loading_ani("off"); // 로딩창 제거
                    resolve();
                    return 0;
                }

                if(res.status === false && res.code === 2) { // 인증만료시
                    if(typeof getAlertPop !== "undefined") {
                        getAlertPop.alert.showAlert("세션이 만료되었습니다.");
                    } else {
                        alert("세션이 만료되었습니다.");
                    }
                    typeof loading_ani !== "undefined" && loading_ani("off"); // 로딩창 제거
                    resolve();
                    return 0;
                }
                Autosave.autosaveData = res.result.data;
                Autosave.autosaveData.contentExtra = JSON.parse(Autosave.autosaveData.contentExtra);
                if(typeof res.result.data.contentExtra === "undefined" || res.result.data.contentExtra === null) {
                    resolve(false);
                    return 0;
                }

                if(typeof getAlertPop === "undefined"){
                    if(confirm("임시저장된 데이터가 있습니다. 불러오시겠습니까?")) {
                        resolve(true);
                        return true;
                    } else {
                        resolve(false);
                        return false;
                    }
                } else {
                    getAlertPop.alert.showAlert("임시저장된 데이터가 있습니다. 불러오시겠습니까?", "headText", "url", "", "head", "align", "confirm", "확인", "취소", "Autosave.loadConfirmCallback(true)", "getAlertPop.alert.close()");
                }
                
            },
            error: function (res) {
                console.log("Error occured at getAutosave::", res)
                resolve(false);
            },
            complete: function() {
            }
        });
    });
}

/**
 * 자동저장 데이터를 입력한다
 * 
 * @date 2021-08-19
 * @author kjk
 * 
 * @param {json} options 
 * @return {void}
 */
Autosave.updateAutosave = function(extraOption) {
    var _this = Autosave;
    return new Promise(function(resolve, reject) {
        var updateFlag = false; // 아래의 검증조건에서 걸리지 않고 이 값이 false로 남아있으면 update하지않음
    
        // 글 내용이 존재하는경우
        if(_this.settings.updateData.content.replace(/&nbsp;|\s|<p>|<\/p>|\t/gi, "") !== "") {
            updateFlag = true;
        }
    
        // 글 제목이 존재하는 경우
        if(_this.settings.updateData.subject.replace(/&nbsp;|\s|<p>|<\/p>|\t/gi, "") !== "") {
            updateFlag = true;
        }
    
        // 페이지 검증에서 변경된 내용이 있을 경우
        if(Autosave.checkUpdateDataChanged() === true) {
            updateFlag = true;
        }
    
        if(updateFlag === false) {
            resolve();
            return 0;
        }
        
        $.ajax({
            type: "POST",
            url: _this.settings.updateAutosaveUrl,
            data: _this.settings.updateData,
            beforeSend: function (xhr) {
                xhr.setRequestHeader('Web-Token', _this.settings.token);
            },
            success: function (res) {
                resolve(res);
            },
            error: function (res) {
                resolve();
            },
            complete: function() {
                console.log('updated');
                reject();
            }
        });
    });
}

/**
 * 자동저장 콜백함수 설정
 * 
 * @date 2021-08-19
 * @author kjk
 * 
 * @param {json} options 
 * @return {void}
 */
Autosave.setInterval = function() { // 인터벌마다 콜백
    // 자동저장 callback function을 interval로 Autosave.settings.autosaveCallIntervalCallback 변수에 입력
    Autosave.settings.autosaveCallIntervalCallback = setInterval(Autosave.setIntervalCallback , Autosave.settings.autosaveInterval);
    // 자동저장 타임아웃 체커 callback function을 interval로 Autosave.settings.autosaveCallIntervalTimeoutCheckerCallback 변수에 입력
    Autosave.settings.autosaveCallIntervalTimeoutCheckerCallback = setInterval(Autosave.setIntervalCheckerCallback, Autosave.settings.autosaveTimeoutCheckerInterval);
}

/**
 * 클릭, 입력, 키 이벤트 발생시 자동저장 데이터를 입력한다
 * 
 * @date 2021-08-19
 * @author kjk
 * 
 * @param {json} options 
 * @return {void}
 */
Autosave.setClickEvent = function() {
    $(document).on("click input keydown keyup", Autosave.settings.clickEventElement, Autosave.setClickEventCallback);
}

Autosave.setClickEventCallback = function(event) {
    Autosave.settings.writeOptionsChanged = true;
    Autosave.settings.autosaveCallIntervalTimeoutCheckerCallback = clearInterval(Autosave.settings.autosaveCallIntervalTimeoutCheckerCallback);
    
    // setInterval로 체커 콜백 재지정
    Autosave.settings.autosaveCallIntervalTimeoutCheckerCallback = setInterval(Autosave.setIntervalCheckerCallback, Autosave.settings.autosaveTimeoutCheckerInterval);
    
    if(typeof Autosave.settings.autosaveCallIntervalCallback === "undefined" || typeof Autosave.settings.autosaveCallIntervalCallback == "") {
        Autosave.settings.autosaveCallIntervalCallback = setInterval(Autosave.setIntervalCallback , Autosave.settings.autosaveInterval);
    }
    return 0;
}

Autosave.setIntervalCheckerCallback = function() {
    // 타임아웃 시간 이후 변경내역이 없다면
    if(Autosave.settings.writeOptionsChanged !== true) {
        Autosave.settings.autosaveCallIntervalCallback = clearInterval(Autosave.settings.autosaveCallIntervalCallback); // 자동저장 콜백 제거
        Autosave.settings.autosaveCallIntervalTimeoutCheckerCallback = clearInterval(Autosave.settings.autosaveCallIntervalTimeoutCheckerCallback);
    }
}

/**
 * 자동저장 옵션 가져오기.
 * 
 * @date 2021-08-17
 * @author kjk
 * 
 * @param {json} options 
 * @return {void}
 * 
 * @date 2021-09-03 kjk 
 * @description callback 함수를 분리
 */
Autosave.getAutosaveData = function() {
    return new Promise(function(resolve, reject) {
        Autosave.getAutosave().then(Autosave.loadConfirmCallback);
    });
}
