# TypeScript Backend Index Access Lab

認可処理で`Record<string, Role[]>`を使う際、存在しないキーを取得しても型上は配列として扱われ、実行時に`undefined.includes`で例外になる問題を再現する教材です。`noUncheckedIndexedAccess`の契約を、失敗テスト、最小修正、回帰テストから学べます。

## 前提環境

Node.js 22系、pnpm 11系、TypeScript 5.7.2、Vitest 2.1.8を利用します。依存関係は`pnpm-lock.yaml`に固定しています。

## 再現

```bash
pnpm install
git checkout d26ce7a
pnpm run repro
```

存在しない`user-not-in-cache`の権限を確認すると、期待する`false`ではなく、`Cannot read properties of undefined (reading 'includes')`が発生します。修正前の型チェックは成功します。

## 修正後の検証

```bash
git checkout 0edf1d6
pnpm run typecheck
pnpm test
```

修正では、`noUncheckedIndexedAccess`を有効化し、未存在キーが`undefined`を含むことを型に反映します。認可関数ではoptional chainingと`?? false`により、キーがない利用者を安全に拒否します。

## 構成

| パス | 役割 |
|---|---|
| `src/authorization.ts` | 権限マップを使う認可処理 |
| `test/authorization.test.ts` | 未存在ユーザーが例外にならず拒否される振る舞いテスト |
| `test/type-contracts.ts` | 未確認キーがundefinedを含む対照ケース |
| `evidence/` | 失敗・修正後の実行結果 |
| `docs/article.md` | 日本語の調査記事 |

## Git履歴

| コミット | 内容 |
|---|---|
| `d26ce7a` | 未存在の権限配列を無条件参照する不具合状態 |
| `0edf1d6` | 未存在キーを安全に拒否する最小修正 |

`noUncheckedIndexedAccess`は認可ポリシーそのものを実装する設定ではありません。認証済みの主体、キャッシュの鮮度、権限取得失敗時の扱いは、別途明確に設計してください。
