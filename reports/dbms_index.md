テーマ：インデックス設計 (INDEX, B-tree, 探索コスト)

# 1. はじめに

データベースの性能（パフォーマンス）に直結する重要な技術である`インデックス（索引）`について学びます。

大量のデータの中から目的の行を素早く見つけるための仕組みであるインデックスの内部構造（B-tree）を理解し、実際にインデックスを作成して検索速度がどのように変化するかを、`探索コスト（Cost）`の観点から検証します。

### 本日の目標

- インデックスの役割とメリット・デメリットを理解する
- B-tree の構造と探索アルゴリズムの概要を把握する
- `EXPLAIN ANALYZE` を用いて実行計画とコストを確認できるようになる
- インデックス作成による検索速度の向上を実験で確認する


##  学習の準備（実験用データの作成）

インデックスの効果を体感するため、10万件のレコードを持つテーブルを作成します。

```sql
-- init-large-table.sql : 実験用テーブルの作成と大量データの生成

DROP TABLE IF EXISTS large_characters;

CREATE TABLE large_characters (
  id SERIAL PRIMARY KEY,
  name VARCHAR(32),
  job VARCHAR(32),
  power INTEGER
);

INSERT INTO large_characters (name, job, power)
SELECT
  'Character-' || i,
  CASE (i % 4)
    WHEN 0 THEN 'Warrior'
    WHEN 1 THEN 'Wizard'
    WHEN 2 THEN 'Priest'
    ELSE 'Archer'
  END,
  (random() * 1000)::INTEGER
FROM
  generate_series(1, 100000) AS s(i);

SELECT * FROM large_characters LIMIT 5;
SELECT count(*) FROM large_characters;
```


## 2. インデックス（INDEX）とは何か
### 2.1 なぜインデックスが必要なのか？
データベースに大量のデータが格納されているとき、特定の条件でデータを検索する処理はどのように行われるでしょうか？
```sql
SELECT * FROM users WHERE email = 'test@example.com';
```
もし users テーブルに 100万件のデータがあり、email にインデックスが無ければ、PostgreSQL は 全行を順番に確認（Sequential Scan） します。

これは計算量で言えば：O(N)
つまりデータ件数に比例して遅くなります。

インデックスがあればどうなるでしょうか？
→ 木構造（B-tree）を使い:O(log N)
で探索できます。

### 2.1 インデックス無しの検索コスト
Step 1: テーブル作成
```sql
CREATE TABLE users (
id SERIAL PRIMARY KEY,
name TEXT,
email TEXT
);
```
Step 2: 100万件データ投入
```sql
INSERT INTO users (name, email)
SELECT
    'user_' || i,
    'user_' || i || '@example.com'
FROM generate_series(1, 1000000) AS i;
```
Step 3: 実行計画確認
```sql
EXPLAIN ANALYZE
SELECT * FROM users WHERE email = 'user_500000@example.com';
```
確認ポイント
- Seq Scan と表示されているか？
- 実行時間はどのくらいか？
- Rows Removed by Filter はどのくらいか？

インデックスが無い場合：
```nginx
Seq Scan on users
```
と表示されます。

これは テーブル全体をなめて検索している ことを意味します。
### 2.2 インデックスを作る
インデックス作成
```sql
CREATE INDEX idx_users_email ON users(email);
```
再度実行計画を確認
```sql
EXPLAIN ANALYZE
SELECT * FROM users WHERE email = 'user_500000@example.com';
```
確認ポイント
- Index Scan または Index Only Scan になっているか？
- 実行時間はどう変化したか？
- 実行計画の cost はどう変わったか？

### 2.3 Seq Scan vs Index Scan の比較
| 項目     | Seq Scan | Index Scan |
| ------ | -------- | ---------- |
| 探索コスト  | O(N)     | O(log N)   |
| 小規模データ | 有利な場合あり  | やや不利       |
| 大規模データ | 不利       | 有利         |
| メモリ使用  | 少        | やや多        |

なぜ小規模データでは Seq Scan が選ばれるのか？
PostgreSQLはコストベース最適化を行います。

少量データでは：
- インデックスを辿るコスト
- テーブルへ戻るランダムアクセス
の方が高くなる場合があります。

### 定着確認
問題1
なぜインデックスを作成すると INSERT や UPDATE が遅くなるのか説明せよ。

解答例

インデックスはデータのコピー（キー＋ポインタ）を別構造として保持するため、
INSERT → インデックスにも追加が必要
UPDATE → キー変更時に再構築
DELETE → インデックスから削除
の処理が発生するため、書き込みコストが増加する。


## 3. インデックスの仕組み（B-tree）
### 3.1 B-treeとはなにか
データベースで最も一般的に使われるインデックス構造が B-tree (B木) です。正確には、PostgreSQL を含む多くのDBMSでは、改良版である B+tree (B+木) が採用されています。
B-tree（Balanced Tree）は、
- 多分木（多分岐木）
- 常に平衡
- ノードに複数キー保持
- ディスクI/O最適化
を目的としたデータ構造です。
`なぜ二分探索木ではダメなのか？`
仮に100万件のデータで：
- 二分木 → 高さ約20
- B-tree（分岐数200）→ 高さ約3
- ディスクI/Oが20回 vs 3回。
ディスクアクセスが支配的コストであるDBでは圧倒的差になります。
`PostgreSQLのB-treeは実質的に B+Tree です。`
B-tree の3つの特徴
`バランスが保たれている (Balanced):`
すべての「リーフノード（末端）」は、ルートからの深さが同じになります。これにより、データの偏りがあっても検索性能が安定します（最悪計算量が $O(\log N)$）。
`ソートされた状態を維持:`
データは常にキー順に並んでいます。これにより「範囲検索（BETWEENや不等号）」や「前方一致検索」が高速になります。ノードの種類:Root Node (ルートノード): 木の入り口。Branch Node (ブランチノード): 中間管理職。次の階層への案内板を持ちます。
`Leaf Node (リーフノード): `
最下層。ここには「テーブル本体のどこにデータがあるか」を示す物理アドレス (TID / ctid) が格納されています。

### 3.2 B-treeの構造解析(pageinspectによる可視化)
インデックスの内部構造を解析するための専用ツールとデータセットを用意します。
PostgreSQL に標準添付されているものの、デフォルトでは無効化されている `pageinspect` を有効にします。これがないと内部データは見られません。
```sql
CREATE EXTENSION IF NOT EXISTS pageinspect;
```
解析用テーブルの作成
構造を理解しやすくするため、単純なIDと、ページ分割を起こしやすくするためのパディング（詰め物）データを含むテーブルを作成します。
```sql
DROP TABLE IF EXISTS btree_depth_study;

CREATE TABLE btree_depth_study (
    id SERIAL PRIMARY KEY,  -- 自動的にB-treeインデックスが作成される
    payload TEXT            -- 1行のサイズを大きくするためのカラム
);

-- データの挿入
-- 1行あたり約1KBのデータを10,000件挿入します。
-- これにより、1ページ(通常8KB)に収まる行数が減り、B-treeの階層(高さ)が生まれやすくなります。
INSERT INTO btree_depth_study (payload)
SELECT rpad('DATA-', 1000, 'x') || i 
FROM generate_series(1, 10000) AS s(i);

-- 統計情報の更新と不要領域の回収
VACUUM FULL btree_depth_study;
ANALYZE btree_depth_study;

-- データの確認
SELECT id, length(payload) FROM btree_depth_study LIMIT 5;
```

ここからは実際に作成した btree_depth_study のインデックス (btree_depth_study_pkey) を解剖します。

#### ステップ1: メタページの確認
B-tree インデックスの第0ブロックは「メタページ」と呼ばれ、木の基本情報が書かれています。
```sql
-- メタ情報の取得
SELECT * FROM bt_metap('btree_depth_study_pkey');
```
出力項目の読み方:
- root: 現在のルートノードが存在するブロック番号。
- level: 木の高さ。
  - 0: ルート兼リーフ（データが極端に少ない）。
  - 1: ルート → リーフ。
  - 2: ルート → ブランチ → リーフ。
メモ: ここで表示された root の番号を覚えておいてください（以降の例では root = 1 と仮定して進めますが、必ずご自身の環境の値を使用してください）。

#### ステップ2: ルートノードの中身を見る
ルートノード（例: Block 1）の中身を見てみましょう。
```sql
-- bt_page_items(インデックス名, ブロック番号)
SELECT itemoffset, ctid, itemlen, left(data, 20) as data_head
FROM bt_page_items('btree_depth_study_pkey', 1);
```
出力内容の解読:
- itemoffset: ページ内のアイテム番号。
- data: そのアイテムが担当する「最小の値（または最大の値）」などのキー情報。
- ctid: ここが最重要です。
- - ルートやブランチの場合、この ctid のブロック番号部分は「次の階層（子ノード）のブロック番号」を指しています。

### 探索アルゴリズムの追跡 (手動 Index Scan)
PostgreSQL エンジンになりきって、id = 5555 というデータを探し出す旅に出ましょう。
このセクションは、実際にSQLを実行しながら読み進めてください。
#### ルートノードの調査
まず、ルートノード（仮に Block 1）を見ます。
```sql
-- ルートノードを見る
SELECT itemoffset, ctid, data 
FROM bt_page_items('btree_depth_study_pkey', 1);
```
考え方:
表示された data の値を見て、5555 が含まれていそうな範囲を探します。
例えば、以下のようなリストがあったとします（16進数表記の場合があるので注意が必要ですが、数字の場合はそのまま読めることが多いです）。
- offset 1: data = 1 -> ctid = (2,1)  (値1以上はBlock 2へ)
- offset 2: data = 3000 -> ctid = (5,1) (値3000以上はBlock 5へ)
- offset 3: data = 6000 -> ctid = (9,1) (値6000以上はBlock 9へ)
この場合、探している 5555 は 3000 より大きく 6000 より小さいので、offset 2 の情報 が正解ルートです。つまり、次は Block 5 に行けばよいことになります。

####  ブランチノード（またはリーフ）の調査
先ほど特定した「次のブロック番号（例: 5）」の中身を見ます。
```sql
-- 次のノードを見る (番号はPhase 1で特定したものに変えてください)
SELECT itemoffset, ctid, data 
FROM bt_page_items('btree_depth_study_pkey', 5);
```
ここでも同様に data を見て、5555 が含まれる範囲を探します。
もし level が 2 以上ある場合は、さらに次のブロックへジャンプします。
最終的に「これ以上の子ノードがない（次のブロックに行くとデータの格納先を指している）」状態、つまり リーフノード に到達するまで繰り返します。

####  リーフノードでの特定
リーフノードに到達したら、data がドンピシャで 5555 になっている行を探します。

```sql
-- リーフノード内を検索 (ブロック番号は適宜変更)
SELECT itemoffset, ctid, data 
FROM bt_page_items('btree_depth_study_pkey', 20) -- 仮のブロック番号
WHERE data::text LIKE '%5555%'; -- データを探す(簡易的な方法)
```
見つかった行の ctid（例: (345, 2)）が、テーブル本体にある実際のデータの住所です。

#### 【Phase 4】 ゴール（データ取得）
```sql
-- 突き止めた住所(ctid)を使ってデータを引っこ抜く
SELECT ctid, * FROM btree_depth_study 
WHERE ctid = '(345, 2)'; -- Phase 3で見つけたctidを入れる
```
これで id = 5555 のデータを、全表走査することなくピンポイントで取得できました。

### 3.4 探索コストとバッファヒット (EXPLAIN ANALYZE BUFFERS)
手動で行ったプロセスを、PostgreSQL は一瞬で行います。その効率を数値で確認しましょう。
#### 比較実験:インデックス検索 (Index Scan)
```sql 
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM btree_depth_study WHERE id = 5555;
```
予想結果: Buffers: shared hit=3 (または4)
意味: ルート(1) → ブランチ(1) → リーフ(1) → テーブルデータ(1) の合計 4ページ（32KB）だけ読み込んだ。
#### 全表走査 (Seq Scan)
無理やりインデックスを使わないようにして計測します。
```sql
-- 一時的にインデックススキャンを禁止
SET enable_indexscan = off;
SET enable_bitmapscan = off;

EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM btree_depth_study WHERE id = 5555;

-- 設定を戻す
SET enable_indexscan = on;
SET enable_bitmapscan = on;
```
予想結果: Buffers: shared hit=XXXX (数千ページ)
意味: テーブルの全ページ（数十MB〜数百MB）をメモリに読み込んだ。

この Buffers の差こそが、システム負荷の差そのものです。アクセス数が少ないということは、ディスクI/Oが減り、CPU負荷も下がり、他のユーザへの影響も小さくなることを意味します。

### インデックス設計のトレードオフ
「速くなるなら全部のカラムにインデックスを作ればいい」というわけではありません。インデックスには明確なコストがあります。
実験: 更新コストの検証
インデックスがある状態とない状態で、データの挿入速度を比較してみましょう。
```sql
-- A. インデックスなしテーブル
CREATE TABLE no_index_table (col1 INT, col2 TEXT);

-- B. インデックスありテーブル (3つのインデックスを作成)
CREATE TABLE heavy_index_table (col1 INT, col2 TEXT);
CREATE INDEX idx_h1 ON heavy_index_table(col1);
CREATE INDEX idx_h2 ON heavy_index_table(col2);
CREATE INDEX idx_h3 ON heavy_index_table(col1, col2);
```
計測用クエリ（\timing） を有効にして実行時間を計測すると分かりやすいです）：
```sql
\timing on

-- Aへの挿入 (10万件)
INSERT INTO no_index_table 
SELECT i, 'test' FROM generate_series(1, 100000) AS s(i);

-- Bへの挿入 (10万件)
INSERT INTO heavy_index_table 
SELECT i, 'test' FROM generate_series(1, 100000) AS s(i);

\timing off
```
解説:
heavy_index_table への挿入は、no_index_table に比べて数倍〜十倍以上の時間がかかるはずです。
これは、テーブルへのデータ追加に加えて、3つの B-tree 構造すべてに対して挿入・ソート・ページ分割の処理 が発生しているためです。
設計の指針:

- 参照 (SELECT) が多いテーブル: インデックスを積極的に活用する。

- 更新 (INSERT/UPDATE) が激しいログテーブル: インデックスは最小限にする。

- カーディナリティ（値の種類）: 「性別」や「削除フラグ」のような値の種類が少ないカラム単体にB-treeインデックスを作っても、検索範囲が十分に絞り込めず、効果が薄い（逆に遅くなる）ことがある。

#### 定着確認
`Q1. 木の高さとパフォーマンス`
データ件数が 1万件から 100万件（100倍）に増えたとき、B-treeインデックスを使った検索のコスト（読み込むページ数）はおよそ何倍になるでしょうか？
A. 100倍
B. 変わらない
C. 数倍（2〜3倍程度）

`Q2. ページ分割 (Page`sqlit)`
インデックスが貼られたカラムに対して INSERT を行い、対象のリーフノードが満杯だった場合、DBMSはどのような処理を行いますか？簡潔に説明してください。

`Q3. インデックスの選択`
SELECT * FROM users WHERE status = 'active' というクエリがあります。status カラムは 'active' か 'inactive' の2値しか取りません。ユーザの99%が 'active' です。
この場合、status カラムにインデックスを作成すべきですか？理由とともに答えてください。

#### 解答例
Q1. 解答: C (数倍程度)解説: B-tree の計算量は $O(\log N)$ です。底（ファンアウト数）が数百と大きいため、データが100倍になっても、木の高さ（深さ）は1段か2段増える程度で済みます。これがB-treeが大規模データに強い理由です。

Q2. 解答解説: 新しいデータを格納するスペースを作るため、満杯になったページを2つに分割します（ページ分割）。データ半分を新しいページに移動し、親ノードに新しいページへのポインタを追加します。これが連鎖するとコストが高くなります。

Q3. 解答: 作成すべきではない解説: データの99%がヒットする場合、インデックスを使ってちまちまアクセスするよりも、テーブル全体をシーケンシャルに読み込んだ方が高速です（ランダムアクセスのオーバーヘッドがないため）。PostgreSQLのプランナも、この場合はインデックスを使わない判断をする可能性が高いです。

## 4. 演習問題
### 演習①：Seq Scan を発生させよ
large_characters テーブルに対して、
あえて Seq Scan を発生させるSQL を書け。

条件：

job = 'Warrior' で検索

インデックスは作らない前提

さらに、実行計画を確認するSQLも書け。

### 演習②：Index Scan に切り替えよ
large_characters に対して、
次のクエリが Index Scan になるように
適切なインデックスを作成せよ。
```sql
SELECT *
FROM large_characters
WHERE name = 'Character-50000';
```
実行計画確認SQLも書け。
### 演習③：複合インデックス設計
以下のクエリを高速化せよ。
```sql
SELECT *
FROM large_characters
WHERE job = 'Wizard'
AND power BETWEEN 700 AND 900;
```
適切な複合インデックスを作成せよ。
実行計画を確認するSQLも書け。

### 演習④：Index Only Scan を発生させよ
btree_depth_study テーブルで
Index Only Scan を発生させるSQLを書け。

条件：
id = 5555 を検索
テーブル本体を読まない構成にせよ

### 演習⑤：インデックスが不利になるケースを再現せよ
status カラム（'active'/'inactive'）のみを持つ
以下のテーブルを作成し、

インデックスを作成
実行計画を確認
インデックスを削除
再度実行計画を確認

するSQLを書け。


## 演習問題解答例
### 演習①：Seq Scan を発生させよ
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM large_characters
WHERE job = 'Warrior';
```
job は4種類しかないため
プランナは Seq Scan を選択する可能性が高い。

### 演習②：Index Scan に切り替えよ
```sql
CREATE INDEX idx_large_characters_name
ON large_characters(name);

EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM large_characters
WHERE name = 'Character-50000';
```
name は高カーディナリティ → Index Scan になる。

### 演習③：複合インデックス設計
```sql
CREATE INDEX idx_job_power
ON large_characters(job, power);

EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM large_characters
WHERE job = 'Wizard'
AND power BETWEEN 700 AND 900;
```
ポイント：左側から使われる,job → power の順

### 演習④：Index Only Scan を発生させよ
```sql
VACUUM ANALYZE btree_depth_study;

EXPLAIN (ANALYZE, BUFFERS)
SELECT id
FROM btree_depth_study
WHERE id = 5555;
```
ポイント：SELECT id のみ,visibility map が必要

### 演習⑤：インデックスが不利になるケースを再現せよ
```sql
CREATE TABLE users_status (
  id SERIAL PRIMARY KEY,
  status TEXT
);

INSERT INTO users_status(status)
SELECT CASE WHEN i % 100 = 0 THEN 'inactive'
            ELSE 'active'
       END
FROM generate_series(1, 100000) AS s(i);

CREATE INDEX idx_status ON users_status(status);

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM users_status
WHERE status = 'active';

DROP INDEX idx_status;

EXPLAIN (ANALYYZE, BUFFERS)
SELECT * FROM users_status
WHERE status = 'active';
```
期待：
インデックスありでも Seq Scan が選ばれる可能性,またはコストがほぼ変わらない

## まとめ
データベースのパフォーマンスを決定づける「インデックス」について、理論と実践の両面から学びました。

1.  **インデックスの威力**:
    * 10万件のデータに対し、インデックスなし（Seq Scan）では全ページを読み込みますが、B-treeインデックス（Index Scan）を使えばわずか数ページ（ルート・ブランチ・リーフ・データ）のアクセスで完了することを、`BUFFERS` オプションを用いて実証しました。
    * この差はデータ量が増えるほど（100万件、1000万件…）指数関数的に広がります。

2.  **B-tree の内部構造**:
    * `pageinspect` を用いて、普段はブラックボックスであるインデックスの中身を覗き見ました。
    * ルートからリーフへとポインタ（ブロック番号）を辿り、最終的に `ctid` (TID) を経由してテーブル本体のデータに到達するプロセスを理解しました。

3.  **設計のトレードオフ**:
    * 「インデックスは多ければ多いほど良い」わけではありません。
    * インデックス作成は「検索速度」と引き換えに、「書き込み速度（INSERT/UPDATEのオーバーヘッド）」と「ディスク容量」を消費します。
    * カーディナリティ（値の種類）が低いカラムや、更新頻度が極端に高いテーブルへのインデックス設計は慎重に行う必要があります。


本コンテンツの作成時間：約10時間