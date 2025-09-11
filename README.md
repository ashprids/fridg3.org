![Uptime Robot status](https://img.shields.io/uptimerobot/status/m801281114-5271d29b1c5b60b9f7c1d275?label=fridg3.org)
[![deploy to fridg3.org](https://github.com/ashprids/fridg3.org/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/ashprids/fridg3.org/actions/workflows/deploy.yml)

# fridg3.org
This repository serves as a method to implement version control for the website, as well as allowing for a more modular workflow when creating future updates.

This repository should not be treated as a backup for the website. Backups are automatically made on the webserver's online dashboard.
## Workflow
When a change is made to the repository, GitHub Actions will automatically begin making the change on the webserver. Here are the steps it takes to do so:
1. Repo is checked out
2. Installs rsync + SSH
3. Sets up SSH key + known hosts
4. Runs rsync to copy repo → server (at /var/www/fridg3.org)

When making an update yet to be released, you can create a new branch and then pull it to main whenever it's ready.

### Permissions
Every file and directory in the website's root must belong to the "deploy" user, otherwise GitHub Actions won't be able to update it. The following commands can be issued on the webserver to ensure this requirement is met:
```bash
sudo chown -R deploy:http /var/www/fridg3.org
find /var/www/fridg3.org -type d -exec chmod 755 {} \;
find /var/www/fridg3.org -type f -exec chmod 644 {} \;
```
If you can't publish microblog posts after an update, ensure the /microblog/ directories have permissions set up for the "http" user:
```bash
sudo chown -R http:http /var/www/fridg3.org/microblog/posts
sudo chmod -R 755 /var/www/fridg3.org/microblog/posts
sudo chown -R http:http /var/www/fridg3.org/microblog/images
sudo chmod -R 755 /var/www/fridg3.org/microblog/images
```
## Media (images, music, videos)
Any media to be added to the website should be moved directly onto the webserver itself, and not pushed to this repository. This rule is in place to ensure that the repository aligns with GitHub's file size restrictions, and for confidentiality should any content have a later planned release date.

Any content within the /resources/ directory is not affected by this rule (with the exception of the homepage's cover image).

## Ignoring files
### .gitignore
Any large files added to a clone of the repository should be marked out with the .gitignore file. If a file type is frequently used, feel free to mark the file extension instead of the file directory.

Anything that updates via the website itself or externally (e.g. /microblog/) should be marked out to prevent content from being deleted.

/admin/ may be pushed to the repository, but remember to mark out any sensitive information (e.g. index.php files containing Discord Webhook URLs).

Make sure you're not excluding anything important whenever changes to .gitignore are made.

### .rsyncignore
Ensure that the .rsyncignore file matches the .gitignore file to prevent GitHub Actions from deleting ignored files from the webserver.

If you want any files to be pushed to the repository but not to the webserver, you can also specify those here. The following files are automatically ignored, and don't need to be specified in this file:
- .git
- .github
- README.md
- LICENSE
- .gitignore
## Copyright & license
All contents of this repository (with exceptions; see below) are free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

Contents of the repository do not share the same rights as contents of the website. For example, music, images, videos and other media on fridg3.org are NOT subject to the GNU General Public License and therefore should be treated with their own respective rights.

The following contents of this repository have their own licensing and copyright terms, as stated by their original owners:
- [NK57 by Typodermic Fonts](https://typodermicfonts.com/)
- [Font Awesome icons](https://fontawesome.com/)
- [Mx437 IBM VGA 8x16 by VileR](https://int10h.org/)
- [Minecraftia by Andrew Tyler](https://andrewtyler.gumroad.com/)

You can view the current license for this repository [here](https://github.com/ashprids/fridg3.org/blob/main/LICENSE).
