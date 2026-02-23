# Drizzle ORM とモダンなデータベース操作手法
## 1. はじめに（ORMの役割とDrizzle ORMの概要）

### 本章の演習環境
本講義では PostgreSQL 17 コンテナ を使用します。

## 1.1 ORM（Object-Relational Mapping）とは何か？

**ORM（オブジェクト関係マッピング）** とは、リレーショナルデータベースの「テーブル」と、プログラミング言語の「オブジェクト（クラス）」を橋渡しする技術です。

なぜこれが必要なのでしょうか？それは、データベースとプログラミング言語では**「世界観（データ構造の捉え方）」が根本的に異なる**からです。

* **データベースの世界 (SQL)**: データを「行と列（テーブル）」で管理し、関連性は「外部キー」で表現する。
* **プログラムの世界 (TypeScript等)**: データを「オブジェクト（プロパティの集合）」として扱い、関連性は「配列」や「ポインタ」で表現する。

このズレを **インピーダンス・ミスマッチ** と呼びます。ORMを使わない場合、開発者はプログラムの中で「SQLの文字列」を一生懸命組み立ててデータベースに送信しなければなりません。

なぜ必要か？
SQLを書く場合：
```sql
INSERT INTO users (name, age) VALUES ('Taro', 20);
```
TypeScriptの世界では：
```TypeScript
const user = new User("Taro", 20);
```
世界観が違う
これを橋渡しするのがORM

### 実験1：ORMを使わない場合
Node.js + pgライブラリで試す。
```Bash
npm init -y
npm install pg typescript ts-node @types/node
```
index.ts
```TypeScript
import { Client } from "pg";

const client = new Client({
  host: "localhost",
  port: 5432,
  user: "postgres",
  password: "postgres",
  database: "drizzle_db",
});

async function run() {
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT,
      age INTEGER
    );
  `);

  await client.query(`
    INSERT INTO users (name, age)
    VALUES ('Taro', 20);
  `);

  const res = await client.query("SELECT * FROM users;");
  console.log(res.rows);

  await client.end();
}

run();
```
【このコードが表している意味（生SQLの課題）】

型がない（Type-Safeではない）: TypeScriptを使っていても、SELECT で取得した結果の構造が分からないため、エディタの入力補完が効かず、タイポによるバグが実行時まで発覚しません。

文字列結合の罠: SQLを文字列で組み立てるため、構文エラー（カンマの抜けなど）を起こしやすく、また SQLインジェクションの脆弱性 を生みやすくなります。

## 1.2 従来のORMとクエリビルダー
生のSQLの辛さを解決するため、様々なツールが生まれました。

- Active Record 型 (例: Ruby on Rails, TypeORMの一部)

→特徴: User.find() のように、データモデル自身がデータベース操作のメソッドを持ちます。

→弱点: テーブル構造とプログラムが密結合になりやすい。

- 高度抽象化 ORM (例: Prisma)

→特徴: 独自の書き方で直感的に操作でき、型安全。

→弱点: 抽象化されすぎていて、裏でどんなSQLが発行されているか見えにくい（ブラックボックス化）。複雑な集計クエリを書くのが苦手。

- クエリビルダー (例: Knex.js)

→特徴: knex("users").where("age", ">", 20) のように、SQLの構文を関数のチェーンで組み立てる。SQLに近い。

→弱点: TypeScriptの「型安全」の恩恵を十分に受けられない。

```TypeScript
User.find()
User.save()
```
Data Mapper型

例：Doctrine,TypeORM（一部）
特徴：エンティティとDB処理が分離

クエリビルダー
例：Knex
```TypeScript
knex("users").where("age", ">", 20);
```
SQLに近いが型安全は弱い

1.3 なぜ今 Drizzle ORM なのか？
Drizzle ORM の特徴
| 特徴     | 内容              |
| ------ | --------------- |
| 型安全    | スキーマと完全連動       |
| 軽量     | 実行時メタデータ最小      |
| SQLライク | 生成SQLが明確        |
| モダン    | TypeScriptファースト |

### Drizzle導入
実際にDrizzleを導入し、先ほどの生SQLとの違いを体感しましょう。
```Bash
npm install drizzle-orm
npm install -D drizzle-kit
```
drizzle.config.ts
```TypeScript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./schema.ts",
  out: "./drizzle",
  driver: "pg",
  dbCredentials: {
    connectionString: "postgres://postgres:postgres@localhost:5432/drizzle_db",
  },
});
```
schema.ts
```TypeScript
import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";

// usersテーブルの定義
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  age: integer("age"),
});
```
TypeScriptから操作
drizzle-test.ts
```TypeScript
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { users } from "./schema";

const client = new Client({
  connectionString: "postgres://postgres:password@localhost:5432/drizzle_db",
});

// logger: true にすると、裏で発行された生のSQLがコンソールに出力されます！
const db = drizzle(client, { logger: true });

async function run() {
  await client.connect();

  // INSERT処理: SQLの INSERT INTO users VALUES (...) とそっくり！
  await db.insert(users).values({
    name: "Hanako",
    age: 25,
    // age: "二十歳" // ← 文字列を入れると、エディタ上で即座にコンパイルエラーになる（型安全！）
  });

  // SELECT処理: SQLの SELECT * FROM users とそっくり！
  const result = await db.select().from(users);

  console.log("取得結果:", result);
  // TypeScriptは result の中身が { id: number, name: string, age: number | null } であることを知っている。
  // console.log(result[0].nmae) // ← タイポするとコンパイルエラーで弾いてくれる！

  await client.end();
}

run();
```
生成されるSQLを確認→
Drizzleは内部で：
```sql
Query: insert into "users" ("name", "age") values ($1, $2)
Params: [ 'Hanako', 25 ]

Query: select "id", "name", "age" from "users"
```
【重要ポイント】
Drizzleは、裏で「謎の魔法」を使っているわけではありません。
私たちが書いたコードを、極めて標準的で無駄のない生のSQL（プリペアドステートメント）に忠実に変換しているだけです。ORMでありながらSQLを隠蔽せず、データベース工学の基礎知識をそのまま活かせるのが、モダンORMの最大の特徴です。

### 定着確認
Q1. インピーダンス・ミスマッチ
データベースの世界とプログラミングの世界の「データ構造の捉え方のズレ」をインピーダンス・ミスマッチと呼びます。このズレを解消し、テーブルをオブジェクトのように扱えるようにする技術（ライブラリ）の総称をアルファベット3文字で何と呼びますか？

Q2. 生のSQLの課題
ORMを使わずに、プログラムの中にSQLを直接文字列として記述する（実験1のような）手法には、どのようなデメリットがあるでしょうか。「TypeScript」「タイポ」という言葉を使って簡潔に説明してください。

Q3. Drizzle ORMの特徴
Drizzle ORMの設計思想として、公式が掲げている「If you know ( A ), you know Drizzle」の ( A ) に入る言葉は何でしょうか？

### 解答
定着確認の解答
Q1. 解答: ORM (Object-Relational Mapping)
Q2. 解答例: 生のSQL文字列ではTypeScriptの型推論（型チェック）が機能しないため、カラム名のタイポやデータ型の不一致があってもコード記述時にエラーにならず、実行時エラーやバグの温床になるというデメリットがある。
Q3. 解答: SQL （※SQLを知っていれば、Drizzleも書ける、という意味）

## 2. 演習環境の構築とスキーマ定義

実際にコードを書いてデータベースを操作するための環境を構築します。
「データベースのテーブル構造」をSQL（DDL）ではなく、**TypeScriptのコードとして定義する（スキーマ定義）**というモダンな手法を学び、その絶大なメリットである「型推論」を実験を通じて体感します。

### 2.1 環境の準備（Node.js / TypeScript / PostgreSQL 17）

今回は、ローカルマシンの Node.js から、Docker コンテナ上で動く PostgreSQL 17 に接続する構成をとります。
ターミナル（WindowsならPowerShell、Macならターミナル）を開き、順番にコマンドを実行して環境を作っていきましょう。

#### PostgreSQL 17 コンテナの起動
まずはデータベース本体を立ち上げます。本科目の標準環境である PostgreSQL 17 をバックグラウンドで起動します。

```bash
# PostgreSQL 17のコンテナをポート5432で起動
docker run --name pg17-drizzle -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=drizzle_db -p 5432:5432 -d postgres:17
```
#### Node.js プロジェクトの初期化
次に、プログラムを書くための作業フォルダ（ディレクトリ）を作成し、初期設定を行います。
```Bash
# 作業ディレクトリの作成と移動
mkdir drizzle-handson
cd drizzle-handson

# package.json の生成（Node.jsプロジェクトの初期化）
npm init -y
```

#### TypeScript環境の構築
TypeScriptを使用します。コンパイル設定ファイル（tsconfig.json）を生成します。
```Bash
# TypeScript関連の基本ツールをインストール
npm install -D typescript tsx @types/node

# tsconfig.json を生成
npx tsc --init
```
(※ tsx は、TypeScriptのコードをコンパイルせずに直接実行するための便利なツールです。)

## 2.2 Drizzle ORM のインストールとデータベース接続設定
環境の土台ができたので、主役である Drizzle ORM と、PostgreSQLに接続するためのドライバ（pg）をインストールします。
```Bash
# アプリケーションの動作に必要なパッケージ
npm install drizzle-orm pg dotenv

# 開発時にのみ必要なパッケージ (型定義やマイグレーションツール)
npm install -D drizzle-kit @types/pg
```
#### 接続情報（環境変数）の設定
データベースのパスワードなどをコードに直接書くのはセキュリティ上危険です。.env ファイルを作成し、接続情報を隔離します。
プロジェクトのルート（一番上の階層）に .env という名前のファイルを作成してください。

```
# .env
# 接続文字列: postgres://ユーザー名:パスワード@ホスト名:ポート番号/データベース名
DATABASE_URL="postgres://postgres:password@localhost:5432/drizzle_db"
```
#### データベース接続ファイルの作成
プログラムから PostgreSQL に接続するための設定ファイルを作成します。
src フォルダを作成し、その中に db.ts を作成してください。

```TypeScript
// src/db.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import 'dotenv/config'; // .env ファイルを読み込む

// コネクションプールの作成
// （データベースへの接続を毎回作るのではなく、プールして使い回すことでパフォーマンスを上げる仕組み）
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Drizzle ORM のインスタンスを作成
// ★重要★ logger: true を設定することで、裏で発行される生のSQLが全てコンソールに出力されます。
// データベース工学を学ぶ上で、ORMがどんなSQLを作っているかを知ることは必須です。
export const db = drizzle(pool, { logger: true });
```

## 2.3 TypeScriptによるスキーマ定義（テーブル構造のマッピング）
従来の開発では、データベースの構築時に CREATE TABLE ... というSQL（DDL）を直接書いていました。
Drizzle ORM では、TypeScriptのコードを使ってテーブルの構造（スキーマ）を定義します。

src/schema.ts を作成し、以下のコードを記述してください。
```TypeScript
// src/schema.ts
import { pgTable, serial, varchar, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

// 1. usersテーブルの定義
// 第一引数 'users' はデータベース上の実際のテーブル名です
export const users = pgTable('users', {
  // id: SERIAL PRIMARY KEY
  id: serial('id').primaryKey(),
  
  // name: VARCHAR(255) NOT NULL
  name: varchar('name', { length: 255 }).notNull(),
  
  // email: VARCHAR(255) NOT NULL UNIQUE
  email: varchar('email', { length: 255 }).notNull().unique(),
  
  // age: INTEGER (NULL許可)
  age: integer('age'),
  
  // created_at: TIMESTAMP NOT NULL DEFAULT NOW()
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. postsテーブルの定義 (リレーション実験用)
export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  
  // author_id: INTEGER NOT NULL REFERENCES users(id)
  // 外部キー制約もTypeScriptのメソッドチェーンで記述します
  authorId: integer('author_id').references(() => users.id).notNull(),
});
```
【解説：データ型のマッピング】
コードのコメントにあるように、Drizzleの関数はPostgreSQLのデータ型と1対1で対応しています。

- serial() → SERIAL 型（自動採番）
- varchar() → VARCHAR 型（可変長文字列）
- .notNull() → NOT NULL 制約
- .references() → FOREIGN KEY (外部キー制約)

このように、**「SQLのDDLで書けることは、すべてDrizzleのコードで書ける」**というのが最大の特徴です。

## 2.4 TypeScriptの型推論がもたらす開発体験（DX）の確認
「なぜわざわざTypeScriptでテーブルを定義するのか？」——その最大の理由は、型推論（Type Inference）による圧倒的な開発体験（Developer Experience = DX）の向上と、実行前バグ検知にあります。

実際にこの恩恵を実験で確かめてみましょう。
src/experiment-dx.ts というファイルを作成し、以下のコードを記述してください。（※まだ実行はしません。VSCodeなどのエディタの画面に注目してください）
```TypeScript
// src/experiment-dx.ts
import { db } from './db';
import { users } from './schema';

async function runExperiment() {
  
  // 実験1: 正しいデータを入れる場合 (エラーなし)
  await db.insert(users).values({
    name: "Taro Yamada",
    email: "taro@example.com",
    age: 20,
  });

  // ---------------------------------------------------------
  // 実験2: わざとデータ型を間違えてみる
  // ---------------------------------------------------------
  await db.insert(users).values({
    name: "Jiro Suzuki",
    email: "jiro@example.com",
    age: "二十歳", // ★ここでエディタ上に赤い波線（エラー）が出ます！
  });

  // ---------------------------------------------------------
  // 実験3: NOT NULL 制約のあるカラムを入れ忘れてみる
  // ---------------------------------------------------------
  await db.insert(users).values({
    age: 30,
    // ★ name と email を書いていないため、.values() の部分に赤い波線が出ます！
  });
}
```
【この実験からわかること（データベース工学の視点）】
もし生のSQL文字列を使って INSERT INTO users (name, age) VALUES ('Jiro', '二十歳') と書いていた場合、プログラム自体はエラーにならずに実行され、データベースにSQLが到達して初めて「データ型が違います」とエラーが返ってきます（実行時エラー）。

しかし、Drizzleでスキーマを定義しておくと、TypeScriptのコンパイラが「age カラムは integer (数値) のはずなのに文字列が入っている」「name は notNull() なのに値が指定されていない」というデータベースの制約違反を、コードを書いているその瞬間に検知してくれます。
これにより、「SQLの構文エラー」や「データ型の不一致」といった初歩的なバグをプログラムを実行する前に100%防ぐことができます。これがモダンなORMを採用する最大のモチベーションです。

### 定着確認 
Q1. 接続管理 (Connection Pool)
データベース接続ファイル (db.ts) において、Client ではなく Pool（コネクションプール）を使用しました。データベース工学において、コネクションプールを使用する主な目的（パフォーマンス上の利点）は何でしょうか？

Q2. ORMの制約定義
PostgreSQLの UNIQUE 制約（重複する値を許さない制約）を、Drizzleのスキーマ定義で表現するには、カラムの定義にどのようなメソッドをつなげればよいでしょうか？

Q3. 開発体験 (DX) と実行時エラー
「実験2」において、生のSQLを使った場合は「実行時エラー」になると解説しました。「実行時エラー」と「コンパイルエラー（エディタ上のエラー）」の違いについて、データベース開発の効率の観点から簡潔に説明してください。

### 解答
Q1. 解答例:
データベースへの接続（TCP通信の確立や認証）は非常にコスト（時間）がかかる処理です。コネクションプールを使うと、一度確立した接続を切断せずに保持（プール）し、次のリクエストで使い回すことができるため、通信のオーバーヘッドを削減し、システムの応答速度を大幅に向上させることができます。

Q2. 解答:
.unique() メソッドを使用する。（例：email: varchar('email').unique()）

Q3. 解答例:
「実行時エラー」は、プログラムを動かしてDBにクエリが送信された後で発覚するため、テスト実行やログ確認の手間がかかり、発見が遅れがちです。一方「コンパイルエラー」は、コードを打ち込んだ瞬間にエディタが指摘してくれるため、タイポや型間違いなどのバグを未然かつ即座に修正でき、開発効率が劇的に向上します。

### SQLドリル
Drizzle ORMのスキーマ定義構文に慣れるための演習です。

#### 課題A：新しいテーブルの定義
企業データベースを想定し、新たに「部署 (departments)」を管理するテーブルを schema.ts に追加定義してください。

【要件 (SQLのDDL)】
```sql
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    dept_name VARCHAR(100) NOT NULL UNIQUE,
    budget INTEGER DEFAULT 0
);
```
上記と同じ意味になる TypeScript のコードを記述してください。

#### 課題B：外部キーの追加
課題Aで作成した departments テーブルと既存の users テーブルを紐づけます。
既存の users テーブルの定義を修正し、department_id カラムを追加してください。

【要件】

- カラム名はプログラム上は departmentId、データベース上は department_id とする。
- データ型は INTEGER（数値）。
- departments テーブルの id を参照する外部キー制約をつける。

NULLを許可する（NOT NULLはつけない）。

### 解答
課題A の解答:
src/schema.ts に以下を追記します。
```TypeScript
export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  deptName: varchar('dept_name', { length: 100 }).notNull().unique(),
  // デフォルト値 0 を設定する場合は .default(0) を使います
  budget: integer('budget').default(0),
});
```
課題B の解答:
users テーブルの定義内に以下の1行を追加します。
```TypeScript
export const users = pgTable('users', {
  // ... (既存のカラム定義) ...
  
  // department_id を追加 (departments.id への外部キー)
  departmentId: integer('department_id').references(() => departments.id),
});
```
解説: TypeScript上のプロパティ名をキャメルケース（departmentId）、DB上のカラム名をスネークケース（department_id）に分けることで、JavaScript/TypeScriptの命名規則を守りながらデータベースの命名規則にも準拠させることができます。

