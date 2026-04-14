[![deploy to fridg3.org](https://github.com/ashprids/fridg3.org/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/ashprids/fridg3.org/actions/workflows/deploy.yml)
[![code lint](https://github.com/ashprids/fridg3.org/actions/workflows/code-lint.yml/badge.svg?branch=main)](https://github.com/ashprids/fridg3.org/actions/workflows/code-lint.yml)
[![backup data directory](https://github.com/ashprids/fridg3.org/actions/workflows/backup-data.yml/badge.svg?branch=main)](https://github.com/ashprids/fridg3.org/actions/workflows/backup-data.yml)

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

## Data Storage
All site data (accounts, audio, downloads, posts and images) must be stored in /data. This directory should be backed up to a location outside the web server every so often.

This directory has to be manually modified and then updated, any updates via Git will not be tracked. This is to ensure the security of the directory's data (sensitive information is stored here) and to keep the total size of the repository low.

Sensitive information must be stored in .json files. The web server will block client access to the .json files, so any reference to the .json files need to be within PHP, not JavaScript.

### Permissions
Every file and directory in the website's root must belong to the "deploy" user, otherwise GitHub Actions won't be able to update it.

/data/ and sitemap.xml will not be writeable by the web server unless they're owned by the "http" user.

Here's a single command that handles all permission issues highlighted above:
```bash
sudo chown -R deploy:http /var/www/fridg3.org && find /var/www/fridg3.org -type d -exec chmod 755 {} \; && find /var/www/fridg3.org -type f -exec chmod 644 {} \; && sudo chown -R http:http /var/www/fridg3.org/data && sudo chmod -R 755 /var/www/fridg3.org/data && sudo chown -R http:http /var/www/fridg3.org/sitemap.xml && sudo chmod -R 755 /var/www/fridg3.org/sitemap.xml
```

## Development
If you wish to develop for or work on fridg3.org, I've made a developer wiki that highlights how the website works and my typical workflow.

You can view the Wiki on GitHub or on the website at https://fridg3.org/wiki. 

The GitHub Wiki is a mirror of the website's Wiki.