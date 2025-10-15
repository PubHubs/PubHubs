#!/usr/bin/env bash

SESSION=pubhubs

# Start new session detached with first command
tmux new-session -d -s $SESSION -n pubhubs 'mask run yivi'

sleep 0.2

# Create splits for each remaining global command
tmux split-window -h -t "$SESSION:1" 'mask run s3'
tmux split-window -v -t "$SESSION:1" 'mask run servers'
tmux split-window -h -t "$SESSION:1" 'mask run client'

# Create hub tab with first command for the hub
tmux new-window -t "$SESSION:2" -n hub 'mask run hub server 0'

# Create split and run the hub client
tmux split-window -h -t "$SESSION:2" 'mask run hub client 0'

# Balance layouts
tmux select-layout -t "$SESSION:1" even-horizontal
tmux select-layout -t "$SESSION:2" even-horizontal

# Attach to the session
tmux attach -t $SESSION
