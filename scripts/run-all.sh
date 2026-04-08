#!/usr/bin/env bash

SESSION=pubhubs

# Start new session detached with first command
tmux new-session -d -s $SESSION -n pubhubs 'mask run yivi'

function cleanup() {
	mask run all cleanup
}

trap 'cleanup' SIGINT EXIT

sleep 0.2

# Create splits for each remaining global command
tmux split-window -h -t "$SESSION:0" 'mask run s3; sleep 3600' 
tmux split-window -h -t "$SESSION:0" 'mask run servers; sleep 3600'
tmux split-window -h -t "$SESSION:0" 'mask run client; sleep 3600'

# Create hub tab with first command for the hub
tmux new-window -t "$SESSION:1" -n hub 'mask run hub server 0; sleep 3600'

# Create split and run the hub client
tmux split-window -h -t "$SESSION:1" 'mask run hub client 0; sleep 3600'

# Balance layouts
tmux select-layout -t "$SESSION:0" even-horizontal
tmux select-layout -t "$SESSION:1" even-horizontal

# Attach to the session
tmux attach -t $SESSION
