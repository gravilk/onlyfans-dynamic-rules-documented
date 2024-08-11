# OnlyFans dynamic rules documented & solved
This repository contains files that will make the creation of OnlyFans easier, if not create them right away.
This tool worked on **2024-08-11** on the file `obfuscated.js`. It is likely that something in the script has changed since then.

### Warning
Trying to "fix" this project while not understanding the inner workings of the OnlyFans script might be a waste of your time. Consider alternative projects or ready-to-use already generated rules.

## How dynamic rules work
Dynamic rules are used to create the `sign` header on OnlyFans that is a required header for most "important" requests.
While obtaining these rules is quite complicated, using them to create the final sign header isn't. For a long time the method to
obtain these rules was not public, and you had to use a public GitHub repository to get the updated JSON.

## This is just security through obscurity
There is no fingerprints involved in this. At least not until you want to create the actual sign header. If you're looking to do that I suggest to look into other repositories.

## How to try this and continue development?
To try this, you just have to download the latest script from OnlyFans (you can usually find it by searching for `abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789` in the DevTools),
put it in the obfuscated.js file and run `node index.js`. Do you want to continue development? Yeah, please 🙃
