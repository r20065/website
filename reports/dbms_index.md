# テーマ：インデックス設計 (INDEX, B-tree, 探索コスト)

---

## 1. はじめに

データベースの性能（パフォーマンス）に直結する重要な技術である**インデックス（索引）**について学びます。

大量のデータの中から目的の行を素早く見つけるための仕組みであるインデックスの内部構造（B-tree）を理解し、実際にインデックスを作成して検索速度がどのように変化するかを、**探索コスト（Cost）**の観点から検証します。

### 本日の目標

- インデックスの役割とメリット・デメリットを理解する
- B-tree の構造と探索アルゴリズムの概要を把握する
- `EXPLAIN ANALYZE` を用いて実行計画とコストを確認できるようになる
- インデックス作成による検索速度の向上を実験で確認する

---

## 2. 学習の準備（実験用データの作成）

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

---

## 2. インデックス（INDEX）とは何か
### 2.1 なぜインデックスが必要なのか？
データベースに大量のデータが格納されているとき、特定の条件でデータを検索する処理はどのように行われるでしょうか？
```spl
SELECT * FROM users WHERE email = 'test@example.com';
```
もし users テーブルに 100万件のデータがあり、email にインデックスが無ければ、PostgreSQL は 全行を順番に確認（Sequential Scan） します。

これは計算量で言えば：O(N)
つまりデータ件数に比例して遅くなります。

インデックスがあればどうなるでしょうか？
→ 木構造（B-tree）を使い:O(log N)
で探索できます。
---
### 2.1 インデックス無しの検索コスト
Step 1: テーブル作成
```spl
CREATE TABLE users (
id SERIAL PRIMARY KEY,
name TEXT,
email TEXT
);
```
Step 2: 100万件データ投入
```spl
INSERT INTO users (name, email)
SELECT
    'user_' || i,
    'user_' || i || '@example.com'
FROM generate_series(1, 1000000) AS i;
```
Step 3: 実行計画確認
```spl
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
```spl
CREATE INDEX idx_users_email ON users(email);
```
再度実行計画を確認
```spl

```
## 4. インデックスの仕組み（B-tree）

### なぜ Seq Scan は遅い？

探索回数がデータ数 $N$ に比例するため（$O(N)$）。

### B-tree の特徴

- データを木構造で管理
- 常にソート済み
- 探索計算量は $O(\log N)$

### 構造

- Root（根）
- Branch（枝）
- Leaf（末端：データ位置）

---

## 5. インデックスの作成と効果検証

### 実験2：インデックス作成

```sql
CREATE INDEX idx_name
ON large_characters(name);
```

### 実験3：再検索

```sql
EXPLAIN ANALYZE
SELECT * FROM large_characters
WHERE name = 'Character-99999';
```

### 変化点

- Seq Scan → **Index Scan**
- 実行時間：25ms → 0.04ms（約500倍高速化）

---

## 6. インデックスの副作用（デメリット）

### ① 書き込み性能低下

INSERT / UPDATE / DELETE のたびに  
B-treeも更新される。

### ② ディスク容量増加

インデックス自体も容量を消費する。

### 設計指針

- WHERE句やJOINでよく使うカラムに作成
- カーディナリティが低い列は慎重に
- むやみに増やさない

---

## 7. 定着確認

### Q1

```sql
SELECT * FROM large_characters WHERE id = 50000;
```

→ 主キーなので **Index Scan**

### Q2

```sql
SELECT * FROM large_characters
WHERE name LIKE 'Character-99%';
```

→ 前方一致なので B-tree が使われる可能性が高い

※ `LIKE '%99%'` は通常 Seq Scan

---

## 8. SQLドリル

### 課題A：複合インデックス

```sql
EXPLAIN ANALYZE
SELECT * FROM large_characters
WHERE job = 'Wizard' AND power > 800;

CREATE INDEX idx_job_power
ON large_characters(job, power);

EXPLAIN ANALYZE
SELECT * FROM large_characters
WHERE job = 'Wizard' AND power > 800;
```

---

### 課題B：インデックス削除

```sql
DROP INDEX idx_name;

EXPLAIN ANALYZE
SELECT * FROM large_characters
WHERE name = 'Character-99999';
```

---

## 9. まとめ

- Seq Scan は $O(N)$
- Index Scan（B-tree）は $O(\log N)$
- 検索は高速化するが、書き込みコストが増える
- 必要なカラムにのみ適切に設計することが重要
