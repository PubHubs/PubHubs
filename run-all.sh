#!/usr/bin/env bash

SESSION=pubhubs

# Start new session detached with first command
tmux new-session -d -s $SESSION -n pubhubs 'mask run yivi'

function cleanup() {
	# Keep sending control + c ('C-c') to the tmux session until
	# the session is gone (or there is some other error).
	#
	# Using 'tmux kill-session pubhubs' would be more ellegant here,
	# but does not give 'docker run ... testhub ...' enough time to exit cleanly.
	#
	# Also, spamming control + c is what the developer would do manually anyways.
	while tmux send-keys -t pubhubs C-c; do
		sleep 0.1
	done
}

trap 'cleanup' SIGINT EXIT

sleep 0.2

# Create splits for each remaining global command
tmux split-window -h -t "$SESSION:0" 'mask run s3'
tmux split-window -h -t "$SESSION:0" 'mask run servers'
tmux split-window -h -t "$SESSION:0" 'mask run client'

# Create hub tab with first command for the hub
tmux new-window -t "$SESSION:1" -n hub 'mask run hub server 0'

# Create split and run the hub client
tmux split-window -h -t "$SESSION:1" 'mask run hub client 0'

# Balance layouts
tmux select-layout -t "$SESSION:0" even-horizontal
tmux select-layout -t "$SESSION:1" even-horizontal

# Attach to the session
tmux attach -t $SESSION
