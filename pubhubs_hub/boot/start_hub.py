#!/usr/bin/env python3

import argparse
import subprocess
import threading

def main():
    parser = argparse.ArgumentParser(
            description="Start a PubHubs hub")

    Program(parser.parse_args()).run()


class Program:
    def __init__(self, args):
        self._args = args
        self._waiter = Waiter()

    def run(self):
        self._waiter.add("yivi", subprocess.Popen(("/usr/bin/irma", 
                        "server",
                        "--issue-perms", "*",
                        "--production",
                        "--no-email",
                        "--no-tls",
                        "--sse",
                        "--allow-unsigned-callbacks",
                        "--no-auth",
                        "-l", "0.0.0.0",
                        "-p", "8089",
                        "--client-listen-addr", "0.0.0.0",
                        "--client-port", "8088")))

        self._waiter.add("synapse", subprocess.Popen(("/start.py",)))

        self._waiter.wait()


class Waiter:
    def __init__(self):
        self._barrier = threading.Barrier(2)

    def add(self, name, process):
        # daemon=True makes sure that this thread does not keep the whole process alive when the main thread exists
        threading.Thread(target=Waiter.wait_for_process_to_exit, args=(name, process, self._barrier), daemon=True).start()

    def wait(self):
        self._barrier.wait()

    @staticmethod
    def wait_for_process_to_exit(name, process, barrier):
        process.wait()
        print(f"ERROR: {name} exited early!")
        barrier.wait()


if __name__ == "__main__":
    main()
