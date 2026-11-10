# DevFest の提出手順

[開発用リポジトリ nuri](https://github.com/Kcvl-DfHack26/nuri) で開発し、審査に出すコードと資料を [DevFest 提出用リポジトリ](https://github.com/Devfest-Hackathon-2026/df-2026-t107) の `main` に置く。提出更新1回につき、提出先にコミットを1件追加する。

## 提出する版を取り込む

1. nuri の `main` に入った検証済みのコミットを選び、40桁の SHA を控える。取り込み中もこの SHA を使う。
2. 提出用リポジトリのクリーンな clone で `git pull --ff-only origin main` を実行する。別の作業で使っている clone にファイルを上書きしない。
3. 次のコマンドで指定した SHA のファイルを一時ディレクトリに展開する。nuri と提出先の clone の絶対パスを指定する。

```bash
set -o pipefail
nuri_dir=/path/to/nuri
submit_dir=/path/to/df-2026-t107
source_sha='ここをnuriの40桁のコミットSHAに置き換える'
snapshot=$(mktemp -d)
git -C "$nuri_dir" archive "$source_sha" | tar -x -C "$snapshot"

rsync -ani --delete --exclude='/.git' --exclude='/README.md' \
  --exclude='/LICENSE' --exclude='/.gitignore' "$snapshot/" "$submit_dir/"
```

削除予定も含めて一覧を確認し、問題がなければ `rsync` の `-n` を外して反映する。この方法では nuri の開発履歴や作業中のファイルを提出先へ取り込まず、元の版から削除されたファイルも提出先に残らない。

## 提出用の表示とライセンスを確認する

- README は今回取り込んだ版のアプリ紹介を使い、冒頭に開発用リポジトリ、対応コミットのフル SHA へのリンク、審査向け Web の URL を載せる。
- 提出先のルート `LICENSE` は CC BY-NC 4.0 とし、チームが権利を持つ提出物への適用を README に明記する。第三者のコード・モデル・素材は元の条件に従い、ライセンスと著作権表示を添える。
- 同梱の MediaPipe Face Landmarker は [Google の配布モデル](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker#models)。モデルカードに記載された [Apache License 2.0](../apps/mobile/modules/face-tracker/assets/LICENSE.face-landmarker) を同梱する。
- 提出先の `.gitignore` にある秘密情報の除外規則を残し、nuri 側の規則を反映する。公開前に、追跡対象に含まれる秘密情報や、再配布条件が確認できていない素材がないかを確認する。

## コミットして提出する

提出先で `git add -A` した後、`git diff --cached --stat` で差分を確認する。提出先用に調整した3ファイルは `git diff --cached --check -- README.md LICENSE .gitignore` で確認する。それ以外は、次の比較で指定の nuri コミットと一致することを確認する。

```bash
objects=$(git -C "$nuri_dir" rev-parse --path-format=absolute --git-path objects)
GIT_ALTERNATE_OBJECT_DIRECTORIES="$objects" \
  git -C "$submit_dir" diff --cached --exit-code "$source_sha" -- . \
  ':(top,exclude)README.md' ':(top,exclude)LICENSE' ':(top,exclude).gitignore'
```

次の形式で1コミットにまとめる。SHA は実際に取り込んだ nuri のフル SHA に置き換え、コミットの主著者を含む4人を毎回記載する。

```text
chore(submission): 🔧 update the nuri snapshot

Update the code and documentation for the DevFest submission.

Nuri-Commit: <nuriの40桁のコミットSHA>
Co-authored-by: 白田 連大 <16751535+ReoHakase@users.noreply.github.com>
Co-authored-by: kaito takahashi <103472960+aururn@users.noreply.github.com>
Co-authored-by: kiyo-cmvs <342392444+kiyo-cmvs@users.noreply.github.com>
Co-authored-by: 塩見茉祐香 <275643613+nkhm-lv@users.noreply.github.com>
```

提出先で `git rev-list --count origin/main..HEAD` が `1` であることと、`git log -1 --format=%B` の SHA と共同著者4人を確認する。`git push origin main` の後、GitHub の提出先 `main` が作成したコミットを指し、両方の README の相互リンクと提出先 README のコミットリンクを開けることを確認する。締切後に書き込みが拒否された場合は、ローカルコミットの SHA と拒否理由をチームに共有する。
