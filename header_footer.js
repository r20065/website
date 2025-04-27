// ヘッダーを読み込む
fetch('header_footer/header.html')
    .then(res => res.text())
    .then(data => {
        document.getElementById('header').innerHTML = data;
    });
fetch('header_footer/footer.html')
    .then(res => res.text())
    .then(data => {
        document.getElementById('footer').innerHTML = data;
    });  