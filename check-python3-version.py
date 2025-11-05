#!/bin/env python3
#
# Checks that the correct version of python is installed.
# This script should run on older python versions too

import sys

required = (3, 13)
present = (sys.version_info[0], sys.version_info[1])

if present >= required:
    sys.exit(0)

print("PROBLEM: PubHubs requires python version >= " + '.'.join(map(str,required)) + \
        ", but " + '.'.join(map(str, present)) + " was found")

sys.exit(1)
