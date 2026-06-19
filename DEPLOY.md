# Rashtra Sarvopari Deployment Guide

## GitHub Desktop

1. Open GitHub Desktop.
2. Choose **File > Add local repository**.
3. Select this folder:
   `C:\Users\Lenovo\Documents\Codex\2026-06-10\nmaskar-bhai`
4. If it asks to trust/add the repo, confirm it.
5. Commit all changes.
6. Click **Publish repository**.

## Netlify

1. Open Netlify.
2. Choose **Add new site > Import an existing project**.
3. Connect GitHub and select the repository.
4. Build settings:
   - Build command: leave empty
   - Publish directory: `.`
5. Deploy.

## Important Files

- `index.html` is the homepage.
- `src/` contains CSS, JS, and data.
- `assets/` contains all images/maps.
- `netlify.toml` contains Netlify deploy settings.
