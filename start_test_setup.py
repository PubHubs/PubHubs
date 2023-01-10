__author__ = "PubHub Team / iHub, Radboud University, Nijmegen, Netherlands"
__license__ = "Apache License, Version 2.0, January 2004"
__version__ = "1.0"


# OS-level dependencies
import os
import sys
from shutil import which
import time
from datetime import datetime

# Process dependencies
from multiprocessing import Process
import subprocess
from subprocess import PIPE

# Request/Response dependencies
from urllib.request import urlopen, Request
from urllib import request, parse
from urllib.error import HTTPError, URLError
import json

## GLOBAL SECTION ##
server = "http://localhost"
port = "8080"

root_dir = os.getcwd()

## METHOD SECTION ##
def matrix_config_permission_change(matrix_config_list: list) -> None:
    """Change the permissions on the directory for docker bind"""
    for config in matrix_config_list:

        # If the permission is not 777 then change it.
        if oct(os.stat(config).st_mode)[-3:] != "777":
            os.chmod(config, 0o0777)


def check_project_dependencies(dep_list: list) -> list[bool]:
    """Check whether `dep_list` is on PATH and marked as executable.
    return   A list of status of each dependency in true/false
    """

    # Return install status of each dependency
    dep_status_list = [{dep_name: which(dep_name) is not None} for dep_name in dep_list]

    # flatten list of dictionary
    dep_status_dict = {dep: status for dep in dep_status_list for dep, status in dep.items()}
    return dep_status_dict


def print_status(dep_dict: dict) -> None:
    print("Package\t\t\t\tStatus")
    print("-------\t\t\t\t------")
    for key in dep_dict:
        print("{:30s}{}".format(key, dep_dict[key]))


def check_server_status(uri) -> int:
    """Check the status of Web server
    return   server information whether its running or not
    """
    req = Request(uri)

    try:
        response = request.urlopen(req)
        return_response = response.__dict__
    except HTTPError as e:
        return_response = e.__dict__
    except URLError as e:
        return_response = e.__dict__
    return return_response


def create_test_pub_hub(url: str) -> str:
    """Creates a test hub.
    return  A Hub identifier in string format.
    """
    hub_id = None
    response = None

    data = {
        "name": "testhub",
        "description": "test_hub_description",
        "redirection_uri": "http://localhost:8008/_synapse/client/oidc/callback",
    }

    # Create a test hub, if it doesn't  store hub information
    req = Request(url + "/admin/hubid/testhub", headers={"X-Admin-API-Key": "api_key"})
    try:
        response = request.urlopen(req)

    # Testhub does not exits
    except HTTPError:

        url_encoded_data = parse.urlencode(data)
        data = url_encoded_data.encode("utf-8")

        req = Request(
            url + "/admin/hubs",
            data=data,
            headers={"X-Admin-API-Key": "api_key", "Content-Type": "application/x-www-form-urlencoded"},
        )

        try:
            post = request.urlopen(req)
            print(post.__dict__)
        except HTTPError as e:
            print(e.__dict__)
        except URLError as e:
            print(e.__dict__)

        req = Request(url + "/admin/hubid/testhub", headers={"X-Admin-API-Key": "api_key"})

        try:
            response = request.urlopen(req)
            print(response.__dict__)
        except HTTPError as e:
            print(e.__dict__)
        except URLError as e:
            print(e.__dict__)

    hub_id = response.read().decode("utf-8")
    return hub_id


def export_hub_secret(hub_id: str, uri: str) -> str:
    """

    returns a secret in string format
    """
    req = Request(uri + "/admin/hubs/" + hub_id + "?secret", headers={"X-Admin-API-Key": "api_key"})

    try:
        response = request.urlopen(req)
        print(response.__dict__)
    except HTTPError as e:
        print(e.__dict__)
    except URLError as e:
        print(e.__dict__)

    return response.read().decode("utf-8")


# option cargo watch //
def run_pubhubs_server(arg: str = None) -> None:
    """This is a Rust server, using the default settings"""

    if arg is None:
        os.system("cargo watch --watch-when-idle -x 'run'")
    else:
        os.system(arg)


def run_docker_compose(env_value=None, args: str = None) -> None:
    """Runs docker compose command with or without supplied arguments"""
    if env_value is None:
        docker_command = "docker compose up -d"
    else:
        docker_command = "HUB_SECRET=" + env_value + " docker compose up -d"
    if args is not None:
        docker_command += args

    subprocess.call(docker_command, shell=True)


# Starting point for building pubhub testing infrastructure
def main_runner() -> None:

    # Check all dependencies for the given project and run pubhubs server and build the pubhubs infrastructure
    dep_list = ["cargo", "cargo-watch", "npm", "docker", "sass", "libpepcli"]
    dep_status_dict = check_project_dependencies(dep_list)

    # All dependencies should be installed. In dictionary, values are status of package
    if not all(dep_status_dict.values()):
        proper_status = {k: ("Installed" if v else "Uninstalled") for k, v in dep_status_dict.items()}
        print_status(proper_status)
        sys.exit("-----Missing dependency----\nPubhubs build will now terminate with failure.")

    # Additional check for docker and docker compose because they could be installed but not running.
    subprocess.check_output("docker ps", shell=True)

    subprocess.check_output("docker compose", shell=True)

    # Change permissions of relevant matrix config directory
    matrix_config_list = [
        "matrix_test_config",
        "matrix_test_config/homeserver.yaml",
        "matrix_test_config/test_hub.log.config",
        "matrix_test_config/testhub.signing.key",
    ]
    os.chdir("pubhubs_hub")
    matrix_config_permission_change(matrix_config_list)
    os.chdir(root_dir)

    run_docker_compose()

    # Run server in another process so that we can keep this script continue executing.
    os.chdir("pubhubs")
    process_pubhub_server = Process(target=run_pubhubs_server)
    process_pubhub_server.start()
    os.chdir(root_dir)

    # Check if the server has been started successfully
    url = server + ":" + port

    while True:
        response = check_server_status(url)
        if "status" in response:
            if response["status"] == 200:
                break
        # This delay is for server to start, but in any case, we are constantly checking the status of the server
        time.sleep(5)

    hub_id = create_test_pub_hub(url)
    hub_secret = export_hub_secret(hub_id, url)

    os.chdir("pubhubs_hub")
    run_docker_compose(hub_secret, " --build --force-recreate")

    # we want the server to continue running in a separate process, we call join()
    # Main process will wait for puhhub server process to finish
    process_pubhub_server.join()


## TEST SECTION ##
import unittest
import re
from unittest import mock
from threading import Thread
import io
from contextlib import redirect_stdout
from http.server import BaseHTTPRequestHandler, HTTPServer
import socket


class MockServerRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Process an HTTP GET request successfully
        if self.path == "/admin/hubid/testhub":
            self.send_response(200)
            # Add response headers.
            self.end_headers()
            self.wfile.write(b"e891800b-b9d8-41b8-a56e-6bcdf8bef76d")

        elif self.path == "/admin/hubs/1234?secret":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"f61146b4dd99446a128240233815c67f79a343ef484d841a4e4222308f605a08")

        else:

            self.send_response(200)
            self.end_headers()


# Utility function in unit testing
def get_free_port():

    s = socket.socket(socket.AF_INET, type=socket.SOCK_STREAM)
    s.bind(("localhost", 0))
    address, port = s.getsockname()
    s.close()
    return port


class TestPubHubsAutomation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Configure mock server
        cls.mock_server_port = get_free_port()
        cls.mock_server = HTTPServer(("localhost", cls.mock_server_port), MockServerRequestHandler)

        # Start running mock server in a separate thread.
        # Daemon threads automatically shut down when the main process exits.
        cls.mock_server_thread = Thread(target=cls.mock_server.serve_forever)
        cls.mock_server_thread.setDaemon(True)
        cls.mock_server_thread.start()

    def test_matrix_config_permission_change(self):
        # Remove the test_dir if assert failed and removedirs at last line was not called
        # To check whether permission changer works, we need a tmp directory
        if os.path.exists("test_dir"):
            os.removedirs("test_dir")
        os.makedirs("test_dir")

        # Check if directory is successfully created
        self.assertEqual(os.path.exists("test_dir"), True)

        # Now test the permission change logic
        matrix_config_permission_change(["test_dir"])
        self.assertEqual(oct(os.stat("test_dir").st_mode)[-3:], "777")
        os.removedirs("test_dir")

    def test_check_project_dependencies(self):
        test_dep_list = ["python3"]
        test_dep_status_result = check_project_dependencies(test_dep_list)
        self.assertEqual(all(test_dep_status_result.values()), True)

    # Capturing formatted output is very tricky.
    # Therefore, we use contextlib to capture the output and then just compare the number of len of characters in the output.
    # We want to test if the formatting done by the method is changed, the test should fail.
    def test_print_status(self):
        test_status_dict = {"libtest": "installed"}
        output = io.StringIO()
        with redirect_stdout(output):
            print_status(test_status_dict)
        self.assertEqual(len(output.getvalue()), 76)

    # This will just check whether subprocess call was made.
    # Therefore I have mocked the call. This test just checks whether the call was made.
    ##Also check for the command
    @mock.patch("subprocess.call")
    def test_run_docker_compose(self, mock_subproc_call):
        run_docker_compose()
        mock_subproc_call.assert_called_once()

    @mock.patch("os.system")
    def test_run_pubhubs_server(self, os_system):
        run_pubhubs_server()
        os_system.assert_called_once_with("cargo watch --watch-when-idle -x 'run'")

    # HTTP endpoint related unit tests.
    def test_check_server_status(self):
        url = "http://localhost:{port}".format(port=self.mock_server_port)
        response = check_server_status(url)
        # We will get a response as a dictionary.
        assert isinstance(response, dict)

    def test_create_test_pub_hub(self):
        url = "http://localhost:{port}".format(port=self.mock_server_port)
        response = create_test_pub_hub(url)
        pattern = "[a-zA-Z0-9]+-[a-zA-Z0-9]+-[a-zA-Z0-9]+-[a-zA-Z0-9]+-[a-zA-Z0-9]+"
        self.assertRegex(response, re.compile(pattern))

    def test_export_hub_secret(self):
        url = "http://localhost:{port}".format(port=self.mock_server_port)

        ## How secrets are generated in Pubhubs. Is there a relationship between hubid and response
        response = export_hub_secret("1234", url)
        pattern = "[a-zA-Z0-9]{64}"
        self.assertRegex(response, re.compile(pattern))


## MAIN SECTION ##
if __name__ == "__main__":
    # normalised any combination of case sentivity e.g., Test, TEST, tEsT etc
    if len(sys.argv) > 1:
        if sys.argv[1].lower() == "test":
            # We dont want argument to be read by test runner.
            unittest.main(argv=["first-arg-is-ignored"], verbosity=2)
        elif sys.argv[1].lower() == "run":
            main_runner()
        else:
            sys.exit(
                "Usage -- python3 start.py run (for running automation) OR python3 start.py test (for running unit tests)"
            )

    # Default behavior in case of no argument supplied i.e., run main
    else:
        sys.exit(
            "Usage -- python3 start.py run (for running automation) OR python3 start.py test (for running unit tests)"
        )
