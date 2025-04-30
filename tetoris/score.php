<?php
// CORS設定: 特定のオリジンのみ許可
header("Access-Control-Allow-Origin: https://www.gesipepa-cycle.com");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// 上位10位まで保存
$MaxCount = 10;

// プリフライトリクエスト対応
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit; // OPTIONSリクエストには処理を返すだけ
}

mainFunc();

function saveToLogFile($message) {
    // ログファイルのパス
    $logFile = './log.txt';

    // 保存するテキストにタイムスタンプを追加
    $timestamp = date("Y-m-d H:i:s");
    $logEntry = "[{$timestamp}] {$message}\n";

    // ファイルに追記
    file_put_contents($logFile, $logEntry, FILE_APPEND | LOCK_EX);
}

function GetFileName(){
    return "./highscore.csv";
}

function sortByKey($key_name, $sort_order, $array) {
    foreach ($array as $key => $value) {
        $standard_key_array[$key] = $value[$key_name];
    }
    array_multisort($standard_key_array, $sort_order, $array);
    return $array;
}

function mainFunc(){
    // https://www.gesipepa-cycle.com/* 以外からのリクエストは拒否する
    $referer = $_SERVER['HTTP_REFERER'];
    

    // リファラチェック
    if (strpos($referer, 'https://www.gesipepa-cycle.com') !== 0) {
        http_response_code(403); // 不正アクセス
        die("Forbidden: Invalid Referer");
    }

    // POSTデータの取得
    $rawData = file_get_contents('php://input');
    $data = json_decode($rawData, true);
    saveToLogFile("Referer: {$referer},データ:{$rawData}");
    // データが無効な場合のエラーハンドリング
    

    $name = $data['name'];
    $score = $data['score'];
    $now = $data['date'];

    // 不適切なデータは処理しない
    if (mb_strlen($name) > 16 || mb_strlen($score) > 16 || $name == "" || false !== strpos($name, '<') || false !== strpos($name, '>') || false !== strpos($name, ' ') || false !== strpos($name, '\n')) {
        http_response_code(400); // 不正なデータ
        die("Invalid input data");
    }

    // スコアデータを追加
    $stack = [];

    // csvファイルが存在するならデータを配列に変換
    if (file_exists(GetFileName())) {
        $allData = file_get_contents(GetFileName());
        $lines = explode("\n", $allData);

        foreach ($lines as $line) {
            $words = explode(",", $line);
            if ($words[0] == "") continue;
            $stack[] = ['name' => $words[0], 'score' => $words[1], 'now' => $words[2]];
        }
    }

    // 新しいデータを配列に追加
    $stack[] = ['name' => $name, 'score' => $score, 'now' => $now];

    // スコアが大きい順に配列をソート
    $sorted_array = sortByKey('score', SORT_DESC, $stack);

    // 上位からMaxCountだけデータを取得してcsvファイルとして保存する
    global $MaxCount;
    $dataCount = count($sorted_array);
    $str = "";
    for ($i = 0; $i < $dataCount; $i++) {
        if ($i >= $MaxCount) break;
        $str .= implode(",", $sorted_array[$i]) . "\n"; // 連想配列をカンマ区切りにする
    }

    // CSVファイルに保存
    file_put_contents(GetFileName(), $str, LOCK_EX);

    // 成功レスポンスを返す
    echo json_encode(['status' => 'success', 'message' => 'Data successfully saved']);
}