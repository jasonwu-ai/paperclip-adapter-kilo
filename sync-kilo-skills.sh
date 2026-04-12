#!/bin/bash
# Sync ~/.claude/skills/ symlinks into ~/.kilocode/skills/
# Run after adding/removing skills in Paperclip dashboard
mkdir -p ~/.kilocode/skills
cd ~/.claude/skills || exit 1
for link in $(find . -maxdepth 1 -type l); do
  target=$(readlink "$link")
  name=$(basename "$link")
  ln -sf "$target" ~/.kilocode/skills/"$name"
done
echo "Synced $(ls ~/.kilocode/skills/ | wc -l) skills to ~/.kilocode/skills/"
