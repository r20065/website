# Drizzle ORM とモダンなデータベース操作手法
## 1. はじめに（ORMの役割とDrizzle ORMの概要）

### 演習環境
PostgreSQL 17 コンテナ を使用します。

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

## 3. データベースマイグレーション（Drizzle Kit）

本章では、前章でTypeScript上に定義したテーブルの「設計図（スキーマ）」を、実際の PostgreSQL 17 データベースに反映させるためのプロセスを学びます。単にテーブルを作るだけでなく、将来の「変更」を安全に管理するための**マイグレーション**という技術を習得します。

### 3.1 マイグレーションとは？（スキーマのバージョン管理の重要性）

プログラムのソースコードは Git（GitHubなど）を使ってバージョン管理を行うのが常識です。いつ、誰が、どの行を変更したのかを記録し、バグがあれば過去のバージョンに「ロールバック（巻き戻し）」することができます。

**では、データベースのテーブル構造（スキーマ）はどうでしょうか？**

開発が進むにつれて、「新しい機能のために `users` テーブルに `is_active` というカラムを追加したい」「`age` カラムのデータ型を変更したい」といった要求が必ず発生します。
このとき、開発者が手動でデータベースにログインして `ALTER TABLE` を実行してしまうと、以下のような致命的な問題が起こります。

1. **環境の不一致**: 開発環境のDBにはカラムが追加されたが、本番環境のDBには追加し忘れた結果、システムがクラッシュする。
2. **チーム開発の崩壊**: Aさんがテーブル構造を変更したが、Bさんの手元のDBには反映されていないため、Bさんのプログラムが動かなくなる。
3. **履歴が追えない**: なぜそのカラムが追加されたのか、誰がいつ変更したのかが全く分からない（レビューができない）。

**マイグレーション（Migration）** とは、データベースのスキーマ変更を「SQLファイルの履歴（バージョン）」としてコード化し、順番に適用していく仕組みのことです。
Drizzle ORM では、**Drizzle Kit** という強力なCLIツールを用いて、TypeScriptのスキーマ定義からマイグレーション用SQLを自動生成・管理します。

---

### 3.2 Drizzle Kit を用いた DDL の自動生成

それでは実際に Drizzle Kit を使って、前章で作成した `schema.ts` から PostgreSQL用のDDL（Data Definition Language: `CREATE TABLE` などの構文）を自動生成してみましょう。

#### Drizzle Kit の設定ファイルの作成
プロジェクトのルートディレクトリ（`package.json` がある階層）に、`drizzle.config.ts` という設定ファイルを作成します。

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';
import 'dotenv/config'; // .envから環境変数を読み込む

export default defineConfig({
  // 1. スキーマ定義ファイルがどこにあるかを指定
  schema: './src/schema.ts',
  
  // 2. 生成されるマイグレーションSQLファイルの出力先ディレクトリ
  out: './drizzle',
  
  // 3. 対象のデータベースエンジン (PostgreSQL)
  dialect: 'postgresql',
  
  // 4. データベースへの接続情報
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  
  // 5. ログを出力して進捗を見やすくする
  verbose: true,
  strict: true,
});
```
#### マイグレーションSQLの生成 (Generate)
```Bash
npx drizzle-kit generate
```
【裏側で起きていること（データベース工学の視点）】
このコマンドを実行すると、Drizzle Kit は以下の高度な処理を行います。

src/schema.ts の内容を読み取り、現在の「理想のデータベース構造」を解析する。

過去に出力したスナップショット（以前のテーブル構造の記録）と比較し、「何が変更されたか（差分）」を計算する。今回は初回なので「全てのテーブルを新規作成する」と判断します。

その差分を埋めるための PostgreSQL 17 用の正しい SQL文（CREATE TABLE や ALTER TABLE）を組み立て、./drizzle フォルダに新しい .sql ファイルとして保存する。

### 3.3 マイグレーションの実行と適用（push と migrate の違い）
SQLファイルが生成されましたが、この時点ではまだ PostgreSQL のコンテナの中身は空っぽのままです。生成されたSQLをデータベースに対して**実行（適用）**する必要があります。

Drizzle には、スキーマを適用するための2つのアプローチがあります。この違いを理解することは、システム運用において極めて重要です。

**アプローチ A: drizzle-kit push (開発環境向け)**
push コマンドは、現在の schema.ts と 実際のデータベースの状態を直接見比べ、強制的にデータベースをスキーマ定義と同じ状態にする コマンドです。

メリット: マイグレーションファイルを意識せず、TypeScriptを書き換えて push するだけで即座にDBが更新されるため、プロトタイピング（試作）が爆速になります。

デメリット: カラムの名前を変更した際などに、Drizzleが「古いカラムを削除(DROP)して新しいカラムを追加する」と誤認し、データが消失（DROP TABLE等）する危険性があります。

**アプローチ B: migrate (本番環境・チーム開発向け)**
migrate は、generate コマンドで作られた .sql ファイル（履歴）を、古いバージョンから順番に実行していく正規の手法です。
データベース内には __drizzle_migrations という履歴管理用の特殊なテーブルが自動作成され、「どのSQLファイルまで実行済みか」が記録されます。

メリット: 意図しないデータ破壊が起きません。GitでSQLファイルをレビュー（確認）してから本番環境に適用できます。

デメリット: スキーマを変更するたびに generate してファイルを残す手間がかかります。

#### データベースへの適用
今回は学習環境での演習であるため、手軽な push コマンドを使用して PostgreSQL コンテナにテーブルを作成します。
```Bash
npx drizzle-kit push
```
成功すると、CHANGES APPLIED という緑色のメッセージが表示され、PostgreSQL 上に users テーブルや posts テーブルが実際に構築されます。

### 3.4 生成されたSQLファイルの中身を解読する
ORMを使う上で、「ORMが勝手に何をやっているか分からない」というブラックボックス状態は絶対に避けなければなりません。
generate コマンドによって ./drizzle フォルダ内に生成された 0000_xxxxx.sql のようなファイルを開き、**データベース工学の視点でDrizzleが作ったSQLを解読（リバースエンジニアリング）**してみましょう。

【生成されたSQLの例】
```sql
CREATE TABLE IF NOT EXISTS "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"author_id" integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"age" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
```
【解読・検証ポイント】

IF NOT EXISTS の利用:
テーブルを作る際、CREATE TABLE IF NOT EXISTS と記述されています。これは「もし既にテーブルが存在していれば何もしない（エラーで落ちない）」という**冪等性（べきとうせい：何度実行しても同じ結果になる性質）**を担保するための工夫です。

SERIAL 型の採用:
IDに指定した serial() は、PostgreSQL特有の SERIAL 型に変換されています。これは内部的にシーケンス（連番発行機）を作成し、自動的にインクリメントする効率的な手法です。

制約の独立化 (CONSTRAINT):
email カラムのユニーク制約が、カラムの横に UNIQUE と書かれるだけでなく、CONSTRAINT "users_email_unique" UNIQUE("email") と名前付きで明示的に定義されています。名前をつけることで、後からこの制約だけを狙って削除（DROP）しやすくなります。

外部キー追加の高度なテクニック (DO $$ BEGIN ... END $$;):
posts テーブルの外部キー（FOREIGN KEY）を追加する部分に注目してください。無名ブロック（DO $$ ...）と例外処理（EXCEPTION WHEN duplicate_object THEN null）が使われています。
これは、「もし既に同じ名前の外部キーが存在していた場合は、エラーで処理全体を止めるのではなく、静かにスキップする」という安全性の高いPostgreSQL独自のスクリプト構文です。

Drizzle ORMは単に動くSQLを吐き出しているのではなく、**「DBA（データベース管理者）が手書きするレベルの、安全で高品質なPostgreSQL構文」**を生成していることがお分かりいただけたでしょうか。

### 定着確認
Q1. push と migrate の用途の違い
スキーマをデータベースに適用する際、開発初期のプロトタイピング環境では drizzle-kit push を使うことが便利ですが、本番環境（Production）のデータベースに対して push を実行することは強く非推奨とされています。その決定的な理由を、「データ」という言葉を使って説明してください。

Q2. 冪等性（べきとうせい）
Drizzleが生成したSQLファイルには CREATE TABLE IF NOT EXISTS のように「既に存在していればスキップする」仕組みが多用されています。このように「1回実行しても100回実行しても、システムが同じ状態に収束する」性質を情報工学の用語で何と呼びますか？（※テキスト中に答えがあります）

Q3. マイグレーションの利点
データベースのスキーマ変更を、DBに直接SQLを打ち込んで変更するのではなく、「マイグレーションファイル（.sql）」としてGit等のバージョン管理システムに残していく運用をとることで、チーム開発においてどのようなメリットがあるでしょうか？1つ以上挙げてください。

### 解答
Q1. 解答例:
push コマンドは強制的にTypeScriptの定義とDBを同期させるため、カラム名を変更した際などに「古いカラムをDROP（削除）して新しいカラムを作成する」という挙動をとる場合があります。本番環境でこれを実行すると、これまでに蓄積された実際のユーザーデータが意図せず消失（削除）してしまう危険性があるためです。

Q2. 解答:
冪等性（べきとうせい / Idempotence）

Q3. 解答例:

「誰が・いつ・なぜそのカラムを追加したのか」という変更履歴がコミットログとして残るため、後から追跡できる。

Gitなどを通じてチームメンバー間でスキーマ変更のファイルが共有されるため、全員の開発環境のデータベース構造を常に統一（同期）させることができる。

変更前にGitHubのPull Request等で、誤ったテーブル変更が行われないか事前にレビューができる。

### SQLドリル
課題：既存テーブルへのカラム追加と差分SQLの確認
仕様変更が発生し、users テーブルに「退会済みかどうか」を判定するための真偽値（boolean）カラム is_active を追加することになりました。

【手順】

src/schema.ts を開き、users テーブルの定義内に以下のカラムを追加してください。

カラム名: isActive (DB上は is_active)

データ型: boolean (真偽値)

デフォルト値: true (デフォルトで有効状態にする)

制約: NOT NULL制約をつける

ヒント: import { boolean } from 'drizzle-orm/pg-core'; が必要です。

ターミナルで npx drizzle-kit generate を実行し、新しいマイグレーションファイルを生成してください。

./drizzle フォルダに新しく作成された SQLファイル（0001_xxxxx.sql など）を開き、どのようなSQL文が生成されたかを確認してください。

### 解答
【手順1の解答 】
```TypeScript
import { pgTable, serial, varchar, integer, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  age: integer('age'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  
  // ★追加するコード
  isActive: boolean('is_active').default(true).notNull(),
});
```
【手順3の解答 (生成されるSQLの確認)】
```sql
ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
```

【解説】
Drizzle Kit は「以前のデータベースの状態」を記憶しているため、今回はテーブルを丸ごと作り直す (CREATE TABLE) のではなく、**「既存の users テーブルに対して、足りない is_active カラムを追加 (ADD COLUMN) するだけ」という、必要最小限の差分SQL（ALTER文）**を正確に計算して生成してくれます。
これが、マイグレーションツールを利用する強力なメリットの一つです。

## 4. 基本的なデータ操作（CRUDとSQL生成メカニズム）

データベースアプリケーションの基本機能は、**CRUD（クラッド）** と呼ばれる4つの操作に集約されます。
* **C**reate（作成）: `INSERT`
* **R**ead（読み取り）: `SELECT`
* **U**pdate（更新）: `UPDATE`
* **D**elete（削除）: `DELETE`

本章では、これらの操作をTypeScriptとDrizzle ORMを用いて記述し、それが裏でどのようなPostgreSQLのコマンドに変換されているかを検証します。

準備として、CRUD処理を試すためのファイル `src/crud.ts` を作成してください。

---

### 4.1 データの挿入（INSERT）とバルクインサート

まずはデータの作成（Create）です。
Drizzleでは、SQLの `INSERT INTO ... VALUES ...` という構文と全く同じメンタルモデルでコードを記述します。

```typescript
// src/crud.ts
import { db } from './db';
import { users } from './schema';
import { eq, gt, like } from 'drizzle-orm'; // 条件式に使う演算子関数

async function runCRUD() {
  console.log('--- 1. INSERT (データの挿入) ---');

  // A. 1件のデータを挿入する
  await db.insert(users).values({
    name: 'Alice',
    email: 'alice@example.com',
    age: 20,
  });
  console.log('Aliceのデータを挿入しました。');

  // B. バルクインサート (複数件の同時挿入) と RETURNING
  // .returning() をつけると、DB側で自動採番されたIDやデフォルト値をNode.js側に返却させることができます。
  const insertedUsers = await db.insert(users).values([
    { name: 'Bob', email: 'bob@example.com', age: 25 },
    { name: 'Charlie', email: 'charlie@example.com', age: 30 },
    { name: 'Dave', email: 'dave@example.com', age: 35 },
  ]).returning();
  
  console.log('バルクインサート結果:', insertedUsers);
}
// 実行用の呼び出し
// runCRUD();
```
【データベース工学の視点：なぜバルクインサートが重要なのか？】
もし1000件のデータを挿入したい場合、for ループを回して「1件のINSERT」を1000回実行すると、アプリケーションとデータベースの間で通信（ネットワーク・ラウンドトリップ）が1000回発生し、システムが著しく遅延します。
複数のデータを配列で一気に渡す「バルクインサート」を行えば、通信は1回で済み、PostgreSQL側も1つのトランザクション内で効率よくディスクに書き込めるため、パフォーマンスが劇的に向上します。

### 4.2 データの検索（SELECT）、更新（UPDATE）、削除（DELETE）
引き続き src/crud.ts の runCRUD 関数の中に、残りの R, U, D の処理を追記していきます。

データの検索（Read / SELECT）
Drizzleでは、WHERE 句の条件に = や > などの記号を直接書くのではなく、インポートした関数（eq, gt, like など）を使用します。
```TypeScript
console.log('\n--- 2. SELECT (データの検索) ---');
  
  // SELECT * FROM users WHERE age > 25 ORDER BY age DESC
  const over25Users = await db.select()
    .from(users)
    .where(gt(users.age, 25)); // gt = Greater Than (より大きい)
    
  console.log('25歳より上のユーザー:', over25Users);
```

データの更新（Update / UPDATE）
【警告】 SQLと同様に、WHERE 句をつけ忘れると「テーブル内の全データ」が更新されてしまうため、注意が必要です。
```TypeScript
console.log('\n--- 3. UPDATE (データの更新) ---');
  
  // UPDATE users SET age = 26 WHERE name = 'Bob' RETURNING *
  const updatedUser = await db.update(users)
    .set({ age: 26 }) // 変更したいカラムと値
    .where(eq(users.name, 'Bob')) // eq = Equal (等しい)
    .returning();
    
  console.log('更新されたユーザー:', updatedUser);
```
データの削除（Delete / DELETE）
```TypeScript
console.log('\n--- 4. DELETE (データの削除) ---');
  
  // DELETE FROM users WHERE name = 'Dave'
  const deletedUser = await db.delete(users)
    .where(eq(users.name, 'Dave'))
    .returning();
    
  console.log('削除されたユーザー:', deletedUser);
```
最後に、ファイルの末尾で関数を呼び出すようにして、ターミナルから実行してみましょう。
```Bash
npx tsx src/crud.ts
```
## 4.3 Drizzleのロガーを有効化し、生SQLを観察する
前章で db.ts を作成した際、意図的に logger: true という設定を入れました。
先ほどのスクリプトを実行すると、コンソールには結果だけでなく、裏で発行された生のSQL（Raw SQL） が大量に出力されているはずです。これを一行ずつ解剖します。

【ログ出力の例と解読】

バルクインサートのログ
```Plaintext
Query: insert into "users" ("name", "email", "age", "created_at", "is_active") values ($1, $2, $3, default, default), ($4, $5, $6, default, default), ($7, $8, $9, default, default) returning "id", "name", "email", "age", "created_at", "is_active"
Params: [ 'Bob', 'bob@example.com', 25, 'Charlie', 'charlie@example.com', 30, 'Dave', 'dave@example.com', 35 ]
```
解読: TypeScriptの配列渡しが、見事に values (...), (...), (...) というPostgreSQLのバルクインサート構文に変換されています。default というキーワードが使われ、現在時刻(created_at)などがDB側で自動設定されるように最適化されています。

検索 (SELECT) のログ
```Plaintext
Query: select "id", "name", "email", "age", "created_at", "is_active" from "users" where "users"."age" > $1
Params: [ 25 ]
```
解読: TypeScriptの gt(users.age, 25) が、SQLの where "users"."age" > $1 に正確にマッピングされています。
ここで、すべてのクエリにおいて、実際の値（'Bob' や 25）がSQL文の中に直接埋め込まれていない ことに気づきましたでしょうか。これが次のテーマである「SQLインジェクション対策」の要です。

## 4.4 SQLインジェクション対策（プリペアドステートメント）
Webアプリケーション開発において最も恐ろしい脆弱性のひとつが SQLインジェクション です。

もし、ORMを使わずに文字列結合でSQLを作っていた場合を想像してください。
```TypeScript
// 危険な生の文字列結合の例
const userName = req.body.name; // ユーザーからの入力
const query = `SELECT * FROM users WHERE name = '${userName}'`;
```
ここで、悪意のあるユーザーが userName に '; DROP TABLE users; -- という文字列を入力すると、SQLが途中で分断され、データベースのテーブルが跡形もなく消去されてしまいます。

PostgreSQLの「プリペアドステートメント」による完全な防御
Drizzle ORMのログで見られた $1, $2 という記号は、PostgreSQLの プリペアドステートメント (Prepared Statement) という仕組みを利用するためのプレースホルダーです。

プリペアドステートメントの通信フローは以下のようになります。

- 構文の送信: アプリケーションはまず「骨組みだけのSQL（SELECT * FROM users WHERE name = $1）」をPostgreSQLに送信します。

- コンパイル: PostgreSQL側で、そのSQLの「構文解析」と「実行計画の作成」を事前に行います。この時点でSQLの「構造」は確定・ロックされます。

- 値のバインド: 後から Params: [ '悪意のある文字列' ] を送信し、プレースホルダー $1 にはめ込みます。

この仕組みにより、後から送られてきた値の中にどんなに危険なSQLのコマンドが含まれていようと、PostgreSQLはそれを「ただの文字列データ」として扱うため、構造が破壊されることは絶対にありません。SQLインジェクション攻撃を根本から無効化する、データベース工学上の最強の盾です。

Drizzle ORMは、すべてのクエリにおいてデフォルトでこのプリペアドステートメントの仕組みを強制的に使用するため、開発者が意識しなくても自動的に最高レベルのセキュリティが担保されるのです。

### 定着確認
Q1. パフォーマンスチューニング
100人のユーザーデータを登録したい場合、db.insert().values() をループ文の中で100回実行するのと、100人分のオブジェクトを入れた配列を1回の db.insert().values(配列) に渡すのとでは、後者の方が圧倒的に高速です。その理由を「ネットワーク」というキーワードを使って説明してください。

Q2. RETURNING 句の役割
INSERTやUPDATEの末尾に .returning() を付与することで得られるメリットは何でしょうか？（例：serial() で定義されたIDカラムに着目して答えてください）

Q3. セキュリティ
Drizzleが出力する Query: のログにおいて、値が入るべき場所に $1, $2 と記載されています。この記号の名称と、これを活用するPostgreSQLの仕組み（脆弱性対策の仕組み）の名前を答えてください。

### 解答
Q1. 解答例:
ループ処理で100回INSERTを実行すると、アプリケーションとデータベースサーバー間で「リクエストを送り、レスポンスを待つ」というネットワークの通信（ラウンドトリップ）が100回発生し、その通信の待ち時間がチリツモとなって処理全体が遅くなります。配列を渡すバルクインサートなら通信が1回で済むため、圧倒的に高速になります。

Q2. 解答例:
PostgreSQL側で自動的に生成された値（serial によって自動採番された id や、defaultNow() によって自動記録された created_at の時刻など）を、再度SELECT文を発行することなく即座にアプリケーション側で取得できるというメリットがあります。

Q3. 解答:

記号の名称: プレースホルダー (Placeholder)

仕組みの名前: プリペアドステートメント (Prepared Statement)

### SQLドリル
CRUD操作の応用問題です。src/drill_crud.ts を作成して実装してください。

- 課題A：複数条件の検索 (AND条件)
users テーブルから、「年齢(age)が 20以上」かつ「名前(name)が 'Alice'」のユーザーを検索するDrizzleのコードを書いてください。

ヒント: 複数条件を組み合わせるには import { and, gte, eq } from 'drizzle-orm'; のように and や gte (Greater Than or Equal: 以上) 関数を使用します。

書き方: .where(and(条件1, 条件2))

- 課題B：部分一致検索 (LIKE) と削除
users テーブルから、メールアドレスに example.com が含まれるユーザーを すべて削除 し、削除されたユーザーのデータを返却 (returning) する処理を書いてください。

ヒント: SQLの LIKE 演算子に相当する like 関数を使用します。% を使ったワイルドカード指定が必要です。

### 解答
課題A の解答:
```TypeScript
import { db } from './db';
import { users } from './schema';
import { eq, gte, and } from 'drizzle-orm';

async function drillA() {
  const result = await db.select()
    .from(users)
    // and() の中に複数の条件式を並べることで、SQLの "AND" 演算子になります
    .where(
      and(
        gte(users.age, 20),
        eq(users.name, 'Alice')
      )
    );
  console.log(result);
}
```
課題B の解答:
```TypeScript
import { db } from './db';
import { users } from './schema';
import { like } from 'drizzle-orm';

async function drillB() {
  const deletedUsers = await db.delete(users)
    // like関数と、文字列中に '%' ワイルドカードを含めることで部分一致になります
    .where(like(users.email, '%example.com%'))
    .returning();
    
  console.log('削除されたデータ:', deletedUsers);
}
```
【解説】
裏で生成されるSQLは DELETE FROM "users" WHERE "users"."email" LIKE $1 RETURNING ... となり、$1 のパラメータとして '%example.com%' が渡されます。Drizzleを使うことで、複雑な条件式もTypeScriptの関数型プログラミングのように美しく、かつ型安全に記述できることが実感できたと思います。
