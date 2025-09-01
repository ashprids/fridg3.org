# fridg3.org
This repository serves as a method to implement version control for the website, as well as allowing for a more modular workflow when creating future updates.

This repository should not be treated as a backup for the website. Backups are automatically made on the webserver's online dashboard.
## Media (images, music, videos)
Any media to be added to the website should be moved directly onto the webserver itself, and not pushed to this repository. This rule is in place to ensure that the repository aligns with GitHub's file size restrictions, and for confidentiality should any content have a later planned release date.

Any content within the /resources/ directory is not affected by this rule (with the exception of the homepage's cover image).
## .gitignore
Any large files added to a clone of the repository should be marked out with the .gitignore file. If a file type is frequently used, feel free to mark the file extension instead of the file directory.

Anything that updates via the website itself or externally (e.g. /microblog/) should be marked out to prevent content from being deleted.

/admin/ may be pushed to the repository, but remember to mark out any sensitive information (e.g. index.php files containing Discord Webhook URLs).

Make sure you're not excluding anything important whenever changes to .gitignore are made.
