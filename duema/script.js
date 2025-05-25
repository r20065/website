//グローバル変数定義
let DECK = [];  //url
let BATTLE = [];   //要素
let SHIELD = [];    //要素
let MANA = [];  //要素
let CARD_URLS = [];  //url
let CEMETERY = []; //url
let TOUCH = null;
let draggedCemeteryUrl = null; // モーダルから出したカードのURL
//スマホドラック&ドロップ変数
let isTouchDragging = false;
let offsetX, offsetY;
let holdTimer = null;
let scrollY = 0; // スクロール位置保持用
//仮のURLS
CARD_URLS = ['https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339275_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339275_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339275_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339275_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100248083_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339209_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339209_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339209_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339209_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100285617_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339089_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339089_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339089_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339089_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100298082_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100321674_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100313316_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100313316_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100313316_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339182_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339182_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339182_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339182_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339131_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339131_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339131_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339131_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100297830_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339071_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339071_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339071_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339071_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339125_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339125_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339125_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339125_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339044_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339044_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339044_1.jpg', 'https://storage.googleapis.com/ka-nabell-card-images/img/s/card/card100339044_1.jpg']
//urlボタンアクション
document.getElementById("submitButton").addEventListener("click", function () {
    let url = document.getElementById("urlInput").value;
    let validUrl = "https://gachi-matome.com/deckrecipe-detail-dm/?tcgrevo_deck_maker_deck_id=";
    // URLの検証
    if (!url.startsWith(validUrl)) {
        alert("無効なURLです！正しいURLを入力してください。");
        return;
    }
    // ボタンを無効化して連打防止
    const submitButton = document.getElementById("submitButton");
    submitButton.remove();
    let log_element = document.getElementById("log");
    log_element.innerHTML = `<p>処理中</p>`

    

    

    // クライアントのIPアドレスを取得
    fetch("https://api64.ipify.org?format=json")
        .then(response => response.json())
        .then(data => {
            let clientIp = data.ip;

            let requestData = {
                url: url,
                client_ip: clientIp
            };

            // PHPサーバーにリクエストを送信
            fetch("https://gesipepa-cycle.com/r20065/duema.php", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestData)
            })
                .then(response => response.json())
                .then(data => {
                    let responseDiv = document.getElementById("response");
                    responseDiv.innerHTML = "";

                    if (data.error) {

                        log_element.innerHTML = `<p style="color:red;">エラー: ${data.error}</p>`;

                    } else if (data.images && data.images.length > 0) {

                        CARD_URLS = [...data.images];//グローバルに代入
                        console.log(CARD_URLS);
                        CARD_URLS.forEach(imgUrl => {
                            // 取得した画像URLを<img>タグとして表示
                            let imgElement = document.createElement("img");
                            imgElement.src = imgUrl;
                            imgElement.alt = "画像";
                            imgElement.style.maxWidth = "100%";  // サイズ調整
                            imgElement.style.marginBottom = "1px";  // 画像間の余白
                            responseDiv.appendChild(imgElement);
                        });

                        start()
                        log_element.innerHTML = `<p>完了！リセットでカードを再配置</p>`;
                    } else {
                        log_element.innerHTML = "<p>画像が見つかりませんでした。</p>";

                    }
                })
                .catch(error => {
                    document.getElementById("log").innerHTML = `<p style="color:red;">エラーが発生しました: ${error}</p>`;
                    start();

                })
                .finally(() => {
                    // 処理中の表示を終了
                    
                });
        })
        .catch(error => {
            alert("IPアドレスの取得に失敗しました: " + error);
            submitButton.disabled = false;
        });
});
//リセットボタンアクション
document.getElementById("submitButton_reset").addEventListener("click", function () {
    const targetIds = ["battle", "cemetery", "shield", "mana", "hand", "hand_tmp", "deck"]; // 消したいエリアのID

    targetIds.forEach(id => {
        let element = document.getElementById(id);
        element.innerHTML = "";
    })
    DECK = CARD_URLS;
    CEMETERY = [];
    console.log("カードをすべて削除しました" + DECK.length + "\n" + CARD_URLS.length);

    start();
});

//クリックしたらメニュー削除
document.addEventListener("click", (event) => {
    // カードやメニュー内をクリックしていない場合、メニューを閉じる
    if (!event.target.closest(".card-container") && !event.target.closest(".card-menu")) {
        noneMenu();
    }
});
document.addEventListener("DOMContentLoaded", () => {
    document.addEventListener("click", (event) => {
        // モーダルをクリックしたら閉じる
        if (event.target.id === "modal") {
            closeModal();
        }
    });

});

//url配列を特定の要素にリスト表示
function create_card_element(urls, elementid, face) {
    const responseDiv = document.getElementById(elementid);

    urls.forEach((imgUrl, index) => {
        //カード要素作成
        const cardElement = document.createElement("div");
        cardElement.className = "card-container";
        cardElement.id = "card_container";

        const cardImg = document.createElement("img");
        cardImg.className = "card-face";
        cardImg.dataset.front = imgUrl;
        cardImg.dataset.back = "ura.jpg";
        cardImg.src = face ? cardImg.dataset.front : cardImg.dataset.back;

        // メニュー
        const cardMenu = document.createElement("div");
        cardMenu.className = "card-menu";
        cardMenu.innerHTML = `
            <div class="menu-item" onclick="openModal(event,this)">詳細を見る</div>
            <div class="menu-item" onclick="flipCard(event,this)">めくる</div>
            <div class="menu-item" onclick="touch_reset(event)">閉じる</div>
        `;
        //山札モーダルに表示する時はメニューを追加
        if (elementid == "deckCardList") {
            cardMenu.innerHTML += `
                <div class="menu-item" onclick="get_card_from_deck(event,this)">手札に加える</div>
            `
        }
        //墓地モーダルに表示する時はメニューを追加
        if (elementid == "cemeteryCardList") {
            cardMenu.innerHTML += `
                <div class="menu-item" onclick="get_card_from_cemetery(event,this)">手札に加える</div>
            `
        }
        cardMenu.style.display = "none";

        //カードコンテナがクリックされた時の処理
        cardElement.addEventListener("click", function (event) {
            
            //赤枠on or off
            if (this == TOUCH) {

                this.style.border = "none";
                TOUCH = null;
                noneMenu()

            } else if(TOUCH == null){
                const parentid = this.parentElement.id;
                if (parentid != "deckCardList" && parentid != "cemeteryCardList") {
                
                    this.style.border = "4px solid red";
                    showMenu(event, this);
                    TOUCH = this;
                }else{
                    TOUCH = null;
                    showMenu(event, this);
                }

            }
            


        })

        cardElement.appendChild(cardImg);
        cardElement.appendChild(cardMenu);
        responseDiv.appendChild(cardElement);
    });
}

//================
//初期設定関連
//================
//デッキセット
function setdeck() {
    let deck = document.getElementById("deck");
    deck.innerHTML = "";

    let imgdeck = document.createElement("div");
    imgdeck.style.position = "relative";
    imgdeck.style.display = "inline-block";
    imgdeck.className = "card-container"; // ← メニュー管理のため追加

    // メニュー表示クリックイベント
    imgdeck.onclick = function (event) {
        event.stopPropagation(); // 他のクリックイベントを止める
        noneMenu(); // 他のメニューを非表示にする

        const menu = imgdeck.querySelector(".card-menu");
        if (menu) {
            menu.style.display = "block";
        }
    };

    // 裏面画像を追加
    let imgElement = document.createElement("img");
    imgElement.src = "ura.jpg";
    imgElement.style.display = "block";
    imgElement.className = "card-face"; // 一応付けておく

    // カードの枚数を表示する要素
    let countSpan = document.createElement("span");
    countSpan.id = "decknum";
    countSpan.textContent = DECK.length;
    countSpan.style.position = "absolute";
    countSpan.style.top = "10px";
    countSpan.style.right = "10px";
    countSpan.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    countSpan.style.color = "white";
    countSpan.style.padding = "5px";
    countSpan.style.borderRadius = "5px";
    countSpan.style.fontSize = "14px";
    countSpan.style.pointerEvents = "none";

    // デッキメニュー
    let deckMenu = document.createElement("div");
    deckMenu.className = "card-menu";
    deckMenu.id = "cardMenu";
    deckMenu.style.display = "none";
    deckMenu.innerHTML = `
        <div class="menu-item" onclick="dorw(event)">ドロー</div>
        <div class="menu-item" onclick="open_deck_modal(event)">山札を見る</div>
    `;

    // 構成
    imgdeck.appendChild(imgElement);
    imgdeck.appendChild(countSpan);
    imgdeck.appendChild(deckMenu);
    deck.appendChild(imgdeck);
}
//デッキ枚数カウンタ
function decknum() {
    let decknum_element = document.getElementById("decknum");
    decknum_element.textContent = DECK.length;
}
//start 山札とシールド手札を用意する
function start() {
    DECK = [...CARD_URLS];
    DECK = shuffle(DECK)
    //シールド抜き出し
    let shield = DECK.splice(0, 5);
    //手札抜き出し
    let hand = DECK.splice(0, 5);
    create_card_element(shield, "shield", false)
    create_card_element(hand, "hand", true)
    setdeck()
}

//================
//関数
//================

//シャッフル関数
function shuffle(array) {
    for (let i = array.length - 1; i >= 0; i--) {
        let rand = Math.floor(Math.random() * (i + 1))
        // 配列の要素の順番を入れ替える
        let tmpStorage = array[i]
        array[i] = array[rand]
        array[rand] = tmpStorage
    }

    return array
}
//カードを手札にする
function dorw(event) {

    event.stopPropagation();
    noneMenu();
    let dorwcard = DECK.splice(0, 1);
    create_card_element(dorwcard, "hand", true);
    decknum();

}
//カードめくる
function flipCard(event, element) {

    if (event != null) {
        event.stopPropagation();
    }

    noneMenu();
    let cardElement = element.closest('.card-container');
    let cardImg = cardElement.querySelector(".card-face"); // カード画像を取得

    // 現在の画像が裏面なら表面に変更、表面なら裏面に変更
    if (cardImg.src.includes(cardImg.dataset.back)) {
        cardImg.src = cardImg.dataset.front; // 裏面 → 表面
        console.log("表面");
    } else {
        cardImg.src = cardImg.dataset.back; // 表面 → 裏面
        console.log("裏");
    }
    touch_reset();
}

//============
//詳細を見るモーダル関連
//============


//モーダル表示(カードの詳細表示)
function openModal(event, element) {
    event.stopPropagation();
    closeCemeteryModal();
    noneMenu();
    touch_reset();
    let cardElement = element.closest('.card-container');
    let img = cardElement.querySelector('.card-face');

    let modal = document.getElementById("imageModal");
    let modalImg = document.getElementById("modalImg");

    // URLを変換
    let modifiedUrl = img.src.replace("/s/", "/");
    modalImg.src = modifiedUrl;

    // 現在のスクロール位置を取得
    let scrollX = window.scrollX || window.pageXOffset;
    let scrollY = window.scrollY || window.pageYOffset;

    // モーダルを表示する位置を調整
    modal.style.position = "absolute";
    modal.style.top = `${scrollY + window.innerHeight / 2}px`;
    modal.style.left = `${scrollX + window.innerWidth / 2}px`;
    modal.style.transform = "translate(-50%, -50%)";


    modal.style.display = "flex";
    MENU = 1;
    return;
}
//モーダル閉じる
function closeModal() {
    document.getElementById("imageModal").style.display = "none";
}

//メニュー表示
function showMenu(event, cardElement) {

    event.stopPropagation();
    noneMenu();
    // クリックされたカードのメニューを表示
    let cardMenu = cardElement.querySelector('.card-menu');

    setTimeout(() => {
        cardMenu.style.display = 'block';
    }, 100);  // 50    


}
// すべてのカードメニューを非表示にする
function noneMenu() {
    let allMenus = document.querySelectorAll('.card-menu');
    allMenus.forEach(menu => {
        menu.style.display = 'none';
    });
}
//移動処理
const dropZoneIds = ["battle", "cemetery", "shield", "mana", "hand", "hand_tmp"]; // 対象のID一覧
dropZoneIds.forEach(id => {
    const dropZone = document.getElementById(id);
    if (dropZone) {

        dropZone.addEventListener("click", function (event) {
            if (TOUCH) {

                console.log("a")
                dropZone.appendChild(TOUCH);
                
                
                // ここでゾーンごとの処理を分ける！
                switch (id) {
                    case "battle":
                        BATTLE.push(TOUCH);
                        break;
                    case "cemetery":

                        addCemetery(TOUCH, dropZone)
                        break;
                        
                    case "shield":

                        SHIELD.push(TOUCH);
                        console.log(SHIELD);
                        break;
                    case "mana":

                        MANA.push(TOUCH)
                        break;
                }
                touch_reset();
                noneMenu();
                
            }

        })

    }
});

//=================
//墓地モーダル関連
//=================
//墓地カード追加
function addCemetery(container, dropZone) {


    const drop_img = container.querySelector(".card-face");
    const frontUrl = drop_img.dataset.front || drop_img.src;
    CEMETERY.push(frontUrl);


    set_cemetery_Modal_img();
}
//墓地モーダル開く
function open_cemetery_modal() {

    if (TOUCH == null) {
        console.log("墓地モーダル開く");
        const modal = document.getElementById("cemeteryModalBox");
        const cardlist = document.getElementById("cemeteryCardList");
        cardlist.innerHTML = ""; // リセット

        if (CEMETERY.length === 0) {
            cardlist.innerHTML = "<p style='color:white;'>墓地は空です。</p>";
        } else {

            create_card_element(CEMETERY, "cemeteryCardList", true);


        }

        modal.style.display = "flex"; // 表示
    }

}
// 墓地モーダルを閉じる処理
function closeCemeteryModal() {
    document.getElementById("cemeteryModalBox").style.display = "none";
}
//墓地画像の変更
function set_cemetery_Modal_img() {
    console.log(CEMETERY);
    const cemetery_element = document.getElementById("cemetery");
    cemetery_element.innerHTML = "";
    const cemetery_img = document.createElement("img");
    if (CEMETERY[CEMETERY.length - 1]) {
        cemetery_img.src = CEMETERY[CEMETERY.length - 1];
        cemetery_element.appendChild(cemetery_img);
    }

}

//=================
//山札モーダル関連
//=================
//山札モーダルを開く
function open_deck_modal(event) {
    if (event != null) {
        event.stopPropagation();
    }
    noneMenu();
    console.log("山札モーダル開く");

    const modal = document.getElementById("deckModal");
    const cardlist = document.getElementById("deckCardList");
    cardlist.innerHTML = "";

    if (DECK.length === 0) {
        cardlist.innerHTML = "<p style='color:white;'>山札は空です。</p>";
    } else {

        create_card_element(DECK, "deckCardList", false);

    }

    modal.style.display = "flex"; // 表示

}
//山札モーダルを閉じる
function close_deck_modal() {
    document.getElementById("deckModal").style.display = "none";
}
//山札モーダル全て表にする
function deck_modal_flip() {
    const containers = document.querySelectorAll("#deckCardList .card-container");

    containers.forEach(container => {

        flipCard(null, container);
    });

}
// 表向きのカードをシャッフルして下に送る
function deck_modal_under() {
    const deckList = document.getElementById("deckCardList");
    const containers = deckList.querySelectorAll(".card-container");

    let frontCards = [];

    containers.forEach(container => {
        const cardImg = container.querySelector(".card-face");
        if (cardImg.src.includes(cardImg.dataset.front)) {
            frontCards.push(container);
        }
    });

    // DOM から削除
    frontCards.forEach(card => {
        deckList.removeChild(card);
    });

    // シャッフル
    frontCards = shuffle(frontCards);

    // 再追加してDECK更新
    DECK = []; // 一度クリアして並び直し
    deckList.querySelectorAll(".card-container").forEach(card => {
        const img = card.querySelector(".card-face");
        if (img) DECK.push(img.dataset.front);
    });

    frontCards.forEach(card => {
        const img = card.querySelector(".card-face");
        if (img) DECK.push(img.dataset.front);
        deckList.appendChild(card);
    });

    console.log("新しいDECK:", DECK);
    close_deck_modal();
}

//カードを手札に加える
function get_card_from_deck(event, element) {
    if (event != null) {
        event.stopPropagation();
    }

    noneMenu();
    let cardElement = element.closest('.card-container');
    let card_img = cardElement.querySelector(".card-face");
    let frontUrl = card_img.dataset.front || card_img.src;
    const index = DECK.indexOf(frontUrl);
    if (index !== -1) {
        DECK.splice(index, 1);
    }
    let hand_zone = document.getElementById("hand");
    cardElement.querySelector(".card-menu").innerHTML = `
            <div class="menu-item" onclick="openModal(event,this)">詳細を見る</div>
            <div class="menu-item" onclick="flipCard(event,this)">めくる</div>
        `;
    hand_zone.appendChild(cardElement);
    setdeck();
}
function get_card_from_cemetery(event, element) {
    if (event != null) {
        event.stopPropagation();
    }

    noneMenu();
    let cardElement = element.closest('.card-container');
    let card_img = cardElement.querySelector(".card-face");
    let frontUrl = card_img.dataset.front || card_img.src;
    const index = CEMETERY.indexOf(frontUrl);
    if (index !== -1) {
        CEMETERY.splice(index, 1);
    }
    let hand_zone = document.getElementById("hand");
    cardElement.querySelector(".card-menu").innerHTML = `
            <div class="menu-item" onclick="openModal(event,this)">詳細を見る</div>
            <div class="menu-item" onclick="flipCard(event,this)">めくる</div>
        `;
    hand_zone.appendChild(cardElement);
    set_cemetery_Modal_img()
}
function touch_reset(event){
    noneMenu();
    if(event){
        event.stopPropagation();
    }
    if(TOUCH){
        TOUCH.style.border = "none";
        TOUCH = null;
    }
    
    
}