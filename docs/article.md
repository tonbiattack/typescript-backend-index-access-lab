# TypeScriptの権限マップで未存在ユーザーが500になる理由：`noUncheckedIndexedAccess`を最小再現から理解する

## この記事で扱う問題

バックエンドでは、利用者IDをキーにロール配列を保持し、権限を確認する実装がよくあります。`Record<string, readonly Role[]>`は辞書型を簡潔に表せますが、任意の文字列キーが実行時に必ず存在することまでは保証しません。本教材では、キャッシュにいない利用者の権限確認が`undefined.includes`となり、拒否応答ではなく500エラーになる問題を扱います。

前提はNode.js 22系、TypeScript 5.7.2、Vitest 2.1.8です。結論は、未宣言キーのインデックスアクセスに`undefined`を加える`noUncheckedIndexedAccess`を有効にし、認可処理で欠損を明示的に拒否することです。[1]

再現コード、失敗・修正のGit履歴、実行証拠は[typescript-backend-index-access-lab](https://github.com/tonbiattack/typescript-backend-index-access-lab)にあります。

## 既存題材との差分

既存のTypeScript記事は、構造的部分型によるIDの取り違え、または画面側のデータ変換を扱っています。今回の焦点は、辞書型のキー存在性と認可のfail-closedな境界です。失敗条件は「型としては`Record<string, T>`だが実行時にキーがないこと」、修正の中心は「未確認の取得結果を`T | undefined`として扱うこと」です。

## 期待していた挙動と実際の挙動

`user-not-in-cache`は権限マップに存在しません。認可判断は例外ではなく`false`を返し、呼び出し元が403などの拒否応答へ変換できるべきです。

| actorId | 期待結果 | 修正前の結果 |
|---|---|---|
| `user-42` | `true` | `true` |
| `user-7` | `false` | `false` |
| `user-not-in-cache` | `false` | `TypeError` |

修正前の実装は短く見えます。

```ts
const rolesByUser: Record<string, readonly Role[]> = {
  "user-42": ["admin"],
  "user-7": ["reader"]
};

export function canDeleteUser(actorId: string): boolean {
  return rolesByUser[actorId].includes("admin");
}
```

次のコマンドで失敗を再現できます。

```bash
git checkout d26ce7a
pnpm install
pnpm run repro
```

出力では、テスト失敗と同時に`tsc --noEmit`の成功が確認できます。

```text
TypeError: Cannot read properties of undefined (reading 'includes')
$ tsc --noEmit
```

## 調査：何を観測し、どの仮説を除外したか

問題がadminロールの値ではなく、取得結果そのものの欠損にあるかを確認します。

| 仮説 | 予測 | 最小実験 | 結果 | 判定 |
|---|---|---|---|---|
| A：ロール名の比較が間違っている | `user-42`でも`false`になる | admin利用者を確認 | `true` | 棄却 |
| B：未存在キーが配列として扱われる | 欠損利用者で`.includes`実行時に例外 | `user-not-in-cache`を確認 | `undefined`への`.includes` | 採用 |

TypeScript公式リファレンスは、`noUncheckedIndexedAccess`を有効にすると、型に明示されていないフィールドの取得結果へ`undefined`を追加すると説明しています。[1] `Record<string, T>`の書式は「存在する任意キーの値が`T`である」ことを記述できますが、外部入力由来のキーが存在する証明にはなりません。

> Turning on `noUncheckedIndexedAccess` will add `undefined` to any un-declared field in the type.
>
> — TypeScript TSConfig Reference [1]

## 修正：なぜこの変更で直るのか

まず、設定を有効にします。

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true
  }
}
```

すると、`rolesByUser[actorId]`は`readonly Role[] | undefined`として扱われます。従来の無条件な`.includes`は型エラーになるため、欠損時の方針を実装する必要があります。

```ts
export function canDeleteUser(actorId: string): boolean {
  return rolesByUser[actorId]?.includes("admin") ?? false;
}
```

この実装は、ロールがある場合だけadminを検索し、利用者が権限マップにいない場合は`false`を返します。認可では、情報が欠けているときに許可しない**fail-closed**の意味論です。ロール情報を必ず取得できる設計であれば、`undefined`を検出して監視ログを出すなど、別の方針にしても構いません。ただし無条件に配列として扱うべきではありません。

## 回帰テスト

修正後も、未存在利用者のテストを残します。また`test/type-contracts.ts`は、`noUncheckedIndexedAccess`が有効なときに次の無条件アクセスがコンパイルできないことを確認します。

```ts
// @ts-expect-error
rolesByUser["user-not-in-cache"].includes("admin");
```

```bash
git checkout 0edf1d6
pnpm run typecheck
pnpm test
```

```text
$ tsc --noEmit
Test Files  1 passed (1)
Tests       2 passed (2)
```

## まとめ

第一に、`Record<string, T>`は任意の実行時キーの存在を保証しません。第二に、外部入力やキャッシュをキーにする処理では`noUncheckedIndexedAccess`で`undefined`の可能性を型へ反映します。第三に、認可境界ではキーが存在しない場合の判断を明示し、許可してしまわないように設計します。

## 参考資料

[1]: https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html "TypeScript TSConfig Reference: noUncheckedIndexedAccess"
[2]: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-4.html "TypeScript 4.4 Release Notes"
