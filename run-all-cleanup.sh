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
