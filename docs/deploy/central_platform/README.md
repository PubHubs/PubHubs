# Only for the pubhubs development team

To add a new hub to pubhubs central add the below code to the end of the pubhubs.toml file
Create an id and fill in the details that the hub owner has provided to you.

```
[[phc.hubs]]
handles = ['<handle>']
name = "<name>"
description = '''<This is an example description>'''
url = '<hub_url>'
# NOTE: To generate a new `id`, use `cargo run tools generate id`
id = '<generated_id>'
```
