#!/usr/bin/env python3
__author__ = "PubHub Team / iHub, Radboud University, Nijmegen, Netherlands"
__license__ = "Apache License, Version 2.0, January 2004"
__version__ = "1.0"


# OS-level dependencies
import os
import sys
import platform
from shutil import which
import time
from datetime import datetime
import re
# Process dependencies
from multiprocessing import Process
import subprocess
from subprocess import PIPE

# Request/Response dependencies
from urllib.request import urlopen, Request
from urllib import request, parse
from urllib.error import HTTPError, URLError
import json
import shutil
# Parsing arguments
import argparse

## GLOBAL SECTION ##
server = "http://localhost"

port = "8080"

root_dir = os.getcwd()

# For some reason...
NPM = ["powershell", "npm"] if platform.system() == "Windows" else ["npm"]

## DOCKER VERSION TO USE >= 24
DOCKER_VERSION = 24

## DOCKER VERSION TO USE >= 24
DOCKER_VERSION = 24

## METHOD SECTION ##

#
def get_homeserver_path(path:str ='pubhubs_hub/matrix_test_config/') -> str:
    """ Get homeserver file path

    Args:
        path (str, optional): _description_. Defaults to 'pubhubs_hub/matrix_test_config/'.

    Returns:
        path(str): Returns the homeserver file path.
    """

    dir_path = os.path.dirname(os.path.join(root_dir, path))
    file_name = "homeserver.yaml"
    return os.path.join(dir_path,file_name)

def matrix_config_permission_change(matrix_config_list: list) -> None:
    """
    Change the permissions on the directory for docker bind.

    Parameters:
    matrix_config_list (list): A list of strings representing directory paths.

    Returns:
    None

    This function changes the permissions on each directory in the list so that
    they can be accessed by a Docker container. If the directory permissions are
    not set to 777 (i.e. full read, write, and execute permissions for everyone),
    then this function will change the permissions to 777 using the os.chmod() method.
    """
    for config in matrix_config_list:

        # If the permission is not 777 then change it.
        if oct(os.stat(config).st_mode)[-3:] != "777":
            os.chmod(config, 0o0777)

def check_project_dependencies(dep_list: list) -> list[bool]:
    """
    Check whether each dependency in `dep_list` is on PATH and marked as executable.

    Parameters:
    dep_list (list): A list of strings representing the names of the dependencies to check.

    Returns:
    dict: A dictionary containing the status of each dependency in `dep_list`.
          The keys are the dependency names, and the values are Boolean values indicating
          whether the dependency is installed and executable.

    This function checks whether each dependency in `dep_list` is installed on the system and marked as executable.
    It returns a dictionary containing the status of each dependency, with Boolean values indicating
    whether each dependency is installed and executable. The keys of the dictionary are the dependency names,
    and the values are the status of each dependency.
    """

    dep_status_list = [{dep_name: which(dep_name) is not None} for dep_name in dep_list]

    # flatten list of dictionary
    dep_status_dict = {dep: status for dep in dep_status_list for dep, status in dep.items()}
    return dep_status_dict


def print_status(dep_dict: dict) -> None:

    """
    Print the status of each dependency in `dep_dict`.

    Parameters:
    dep_dict (dict): A dictionary containing the status of each dependency.
                     The keys are the dependency names, and the values are Boolean values indicating
                     whether the dependency is installed and executable.

    Returns:
    None

    This function prints the status of each dependency in `dep_dict`. It takes a dictionary
    containing the status of each dependency as input, where the keys are the dependency names
    and the values are Boolean values indicating whether each dependency is installed and executable.
    The function prints the status of each dependency in a formatted table, with two columns:
    the dependency name and its status (either 'True' or 'False').
    """


    print("Package\t\t\t\tStatus")
    print("-------\t\t\t\t------")
    for key in dep_dict:
        print("{:30s}{}".format(key, dep_dict[key]))


def check_server_status(uri) -> dict:

    """
    Check the status of a server at the specified URI.

    Parameters:
    uri (str): The URI to check, in the format "http://example.com".

    Returns:
    dict: A dictionary containing information about the server response.
          The dictionary contains the following keys:
          - 'code': The HTTP status code returned by the server, or -1 if an error occurred.
          - 'reason': The HTTP reason phrase returned by the server, or the error message if an error occurred.
          - 'headers': A dictionary of HTTP headers returned by the server, or an empty dictionary if an error occurred.

    This function sends a request to the specified URI using the urllib library, and returns a dictionary
    containing information about the server response. If the request is successful, the dictionary contains
    the HTTP status code, reason phrase, and headers returned by the server. If an error occurs, the dictionary
    contains an error code (-1), an error message, and an empty dictionary for headers.
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


def create_test_pub_hub(url: str, hub_name, matrix_server_port, client_port) -> str:
    """
    Creates a test hub with the specified name, description, and ports.

    Parameters:
    url (str): The base URL of the Matrix server.
    hub_name (str): The name of the test hub to create.
    matrix_server_port (int): The port number of the Matrix server.
    client_port (int): The port number of the test client.

    Returns:
    str: The identifier of the newly created hub, in string format.

    This function creates a test hub with the specified name, description, and ports.
    If a hub with the specified name already exists, the function retrieves its identifier instead.
    The function sends HTTP requests to the Matrix server's admin API to create or retrieve the hub,
    using the X-Admin-API-Key header to authenticate the request. The function returns the identifier
    of the newly created or existing hub, in string format.
    """
    hub_id = None
    response = None

    data = {
        "name": hub_name,
        "description": "test_hub_description",
        "oidc_redirect_uri": f"http://localhost:{str(matrix_server_port)}/_synapse/client/oidc/callback",
        "client_uri": f"http://localhost:{str(client_port)}"
    }

    # Create a test hub, if it doesn't  store hub information
    req = Request(url + "/admin/hubid/"+hub_name, headers={"X-Admin-API-Key": "api_key"})
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

        req = Request(url + "/admin/hubid/"+hub_name, headers={"X-Admin-API-Key": "api_key"})

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
    Retrieve the secret associated with the specified hub ID from the admin API endpoint.

    Args:
        hub_id (str): The ID of the hub for which the secret is being retrieved.
        uri (str): The base URI of the hub admin.

    Returns:
        str: The secret associated with the specified hub ID, as a UTF-8 encoded string.

    Raises:
        HTTPError: If an HTTP error occurs while retrieving the secret.
        URLError: If a network error occurs while retrieving the secret.
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


def get_odic_secret_info(hub_id: str, uri: str) -> str:
    """
    Retrieve the secret information associated with the specified hub ID from the admin API endpoint.

    Args:
        hub_id (str): The ID of the hub for which the secret information is being retrieved.
        uri (str): The base URI of the admin API.

    Returns:
        str: The secret information associated with the specified hub ID, as a UTF-8 encoded string.

    Raises:
        HTTPError: If an HTTP error occurs while retrieving the secret information.
        URLError: If a network error occurs while retrieving the secret information.
    """
    req = Request(uri + "/admin/hubs/" + hub_id , headers={"X-Admin-API-Key": "api_key"})

    try:
        response = request.urlopen(req)
        print(response.__dict__)
    except HTTPError as e:
        print(e.__dict__)
    except URLError as e:
        print(e.__dict__)

    return response.read().decode("utf-8")


def get_oidc_id_secret(html_str:str) -> tuple[str]:
    """
    Extract the OpenID Connect client ID and client secret from a string of HTML code.

    Args:
        html_str (str): A string of HTML code containing the OpenID Connect client ID and client secret.

    Returns:
        tuple[str]: A tuple containing the OpenID Connect client ID and client secret, in that order.

    Raises:
        AttributeError: If the client ID or client secret cannot be found in the HTML code.
    """
    import re
    client_id_pattern = r'OpenID Connect Client ID:</dt>\s*<dd>(.*?)</dd>'
    client_password_pattern = r'OpenID Connect Client Password:</dt>\s*<dd>(.*?)</dd>'
    client_id = re.search(client_id_pattern, html_str).group(1)
    client_password = re.search(client_password_pattern, html_str).group(1)
    return client_id, client_password



def run_external_command(arg:str) -> None:

    """
    Execute a command in the shell.

    Args:
        arg (str): The command to execute.

    Returns:
        None
    """

    if arg:
        os.system(arg)

def build_test_hub_image(image_name, dockerfile="Dockerfile"):

    """
    Build a Docker image with the specified name.

    Args:
        image_name (str): The name of the Docker image to build.

    Returns:
        None
    """

    docker_build_command = ["docker", "build",
                            "-t", image_name,
                            "-f", dockerfile, 
                            "."]
    print(f"\033[92m{docker_build_command}\033[0m")
    if subprocess.call(docker_build_command) != 0:
        raise RuntimeError(f"{docker_build_command} failed")

def docker_run_hub_client(image_name, client_number, container_name, client_port, hub_matrix_port):
    """
    Run a Docker container using the specified image and environment variables.

    Args:
        image_name (str): The name of the Docker image to use.
        container_name (str): The name of the container to create and run.
        client_port (str): The local port on which to expose the hub client.
        hub_matrix_port (str): The local port on which to reach the hub server.

    Returns:
        None
    """

    docker_command = ["docker", "run",
                      "--name", container_name,
                      "-e", f"PORT={client_port}",
                      "-e", "BAR_URL=frame-ancestors http://localhost:8080",
                      "-e", f"HUB_URL=http://localhost:{hub_matrix_port}",
                      "-e", "PARENT_URL=http://localhost:8080",
                      "-d", 
                      "-p", f"{client_port}:8800",
                      image_name]
    print(f"\033[92m{docker_command}\033[0m")
    subprocess.call(docker_command)
    docker_copy_command = [ "docker", "cp", f"{root_dir}/hub-client/public/img/testlogos/logo{client_number}.svg", f"{container_name}:/usr/var/static/img/logo.svg"]
    print(f"\033[92m{docker_copy_command}\033[0m")
    subprocess.call(docker_copy_command)
    docker_copy_command =  ["docker", "cp", f"{root_dir}/hub-client/public/client-config.empty.js", f"{container_name}:/usr/var/static/client-config.local.js"]
    print(f"\033[92m{docker_copy_command}\033[0m")
    subprocess.call(docker_copy_command)


def docker_run_hub_server(hub_secret, image_name, container_name, hub_matrix_port, config_dir):
    """
    Run a Docker container using the specified image and environment variables.

    Args:
        hub_secret (str): The value of the HUB_SECRET environment variable.
        image_name (str): The name of the Docker image to use.
        container_name (str): The name of the container to create and run.
        hub_matrix_port (str): The local port on which to expose the hub server.
        config_dir (str): The local dir holding synapse config and data,
            to be mounted into the container.

    Returns:
        None
    """

    # Hack to run the Hub containers in a sort of 'watch mode'.
    # If in 'watch mode', the container will use the pubhubs_hub/modules directory from your os instead of the container.
    # Furthermore, the container will only start the yivi server and not the synapse server
    # The synapse server can than be started and stopped manually by running the start.py file from the container.
    # The result is that you can make changes in the pubhubs_hub/modules directory,
    # manually stop and start the synapse server and see the changes withouth running this whole script.
    # TODO implement this properly (by using parameters instead of environment variables)
    mount_modules = []
    dont_start_hub = ["-e", "DONT_START_HUB=0"]
    if (os.getenv('WATCH_MODULES') == '1'):
        print("\033[31mWATCH_MODULES enabled, will not start the Hub. Do so manually by running ./start.py from inside the docker container.\033[0m")
        mount_modules = ["-v", f"{os.path.abspath(f'modules')}:/conf/modules:ro"]
        dont_start_hub = ["-e", "DONT_START_HUB=1"]

    docker_command = ["docker",
                      "run", 
                      "--name", container_name,
                      "-d", 
                      "-p", f"{hub_matrix_port}:{hub_matrix_port}",
                      "-e", f"HUB_SECRET={hub_secret}",
                      *dont_start_hub,
                      "-e", "SYNAPSE_CONFIG_DIR=/data", 
                      "-e", "AUTHLIB_INSECURE_TRANSPORT=for_testing_only_of_course",
                      "-v", f"{config_dir}:/data:rw",
                      *mount_modules,
                      "--add-host", "host.docker.internal:host-gateway",
                      image_name]
    print(f"\033[92m{docker_command}\033[0m")
    subprocess.call(docker_command)

def run_docker_compose(env_value=None, args: str = None) -> None:

    """
    Start the services defined in a Docker Compose file.

    Args:
        env_value (str): The value of the HUB_SECRET environment variable.
        args (str): Additional arguments to pass to the `docker compose up` command.

    Returns:
        None
    """

    docker_command = ["docker", "compose", "up", "--build", "-d"]

    if args is not None:
        docker_command += args

    print(f"\033[92m{docker_command}\033[0m")
    subprocess.call(docker_command)


def update_homeserver_yaml(input_path, output_path, client_id, client_secret,client_port, hub_port):

    """
    Write the homeserver.yaml file with the specified client ID, client secret, and client URL.

    Args:
        input_path (str): The path to an existing homeserver.yaml file to use as a template.
        output_path (str): The path to the homeserver.yaml file.
        client_id (str): The new client ID to use.
        client_secret (str): The new client secret to use.
        client_port (int): The port number to use for the client.

    Returns:
        None
    """

    with open(input_path, 'r') as f:
        # Read the file content
        lines = f.readlines()

        # Find the lines to update based on their content
        for i, line in enumerate(lines):
            # Check if the line starts with 'client_id:' or 'client_secret:'
            if line.strip().startswith(('client_id:', 'client_secret:', 'client_url:', 'public_baseurl:','- port:')):
                # Get the whitespace before the key
                whitespace = line[:-len(line.lstrip())]

                # Create the updated line with the same whitespace and the new value
                if line.strip().startswith('client_id:'):
                    lines[i] = f'{whitespace}client_id: {client_id}\n'
                elif line.strip().startswith('client_secret:'):
                    lines[i] = f'{whitespace}client_secret: {client_secret}\n'
                elif line.strip().startswith('client_url:'):
                    lines[i] = f'{whitespace}client_url: "http://localhost:{client_port}",\n'
                elif line.strip().startswith('public_baseurl:'):
                    lines[i] = f'{whitespace}public_baseurl: "http://localhost:{hub_port}"\n'
                else:
                    lines[i] = f'{whitespace}- port: {hub_port}\n'

    with open(output_path, 'w') as f:
        f.writelines(lines)


def initialization():
    """
    Initializes the setup for the script such as creting backup files and modifying some files.

    Args:
        None

    Returns:
        None
    """
    pass  # currently nothing needed


def post_processing():
    """
    Resets the state of the project i.e., removes any modified files and restors back to original files.

    Args:
        None

    Returns:
        None
    """
    pass  # currently nothing needed


def run_command(cmd):

    """
    Run the specified command in a subprocess and capture its stdout and stderr output.

    Args:
        cmd (tuple): The command to run.

    Returns:
        A tuple containing the stdout and stderr output from the subprocess.
    """

    print(f"\033[92m{cmd}\033[0m")
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return result.stdout.strip(), result.stderr.strip()


def remove_container(container_name):

    """
    Stop and remove the specified Docker container, if it is running or exists.

    Args:
        container_name (str): The name of the container to remove.

    Returns:
        None
    """
    cmd = ["docker", "ps", 
           "-a",  
           "--filter", f"name={container_name}",
           "--format", "{{.Names}}"]
    container_status, _ = run_command(cmd)
    print(f"docker ps output: {repr(container_status)}")

    # If the container is running or exists, stop and remove it
    if container_status == container_name:
        print(f"Stopping and removing container {container_name}...")

        # Stop the container
        stop_cmd = ["docker", "stop", container_name]
        _, stop_error = run_command(stop_cmd)
        if stop_error:
            print(f"Error stopping the container: {stop_error}")
        else:
            # Remove the container
            rm_cmd = ["docker", "rm", container_name]
            _, rm_error = run_command(rm_cmd)
            if rm_error:
                print(f"Error removing the container: {rm_error}. Do it Manually!")
                print(f"The script with Stop now...")
                exit(-1)
            else:
                print(f"Container {container_name} has been removed.")



# No need for having a unit test for cli_error_message() code.
def cli_error_message():
    sys.exit(
            "Usage -- python3 start_test_setup.py [Main Command] [Options]\n\n"
            "Example:  python3 start_test_setup.py [exec] [--cargo-enabled ARGS..  --scale ARGS..]\n\n"
            "\nMain Command:\n"
            "\texec  Executes the script with options\n\n"
            "\ttest  Tests the script. Only for testing purpose [No Options required]\n\n"
            "\nOptions:\n\n"
            "\n--cargo-disabled\tThis will not run Rust code from the script. You can run Cargo separately\n\n"
            "\n--cargo-enabled\t\t<argument for running cargo> \t e.g., run or cargo watch --watch-when-idle -x 'run'\n\n"
            "\n--scale\t\t\tScales the number of hubs and clients [default: 1]\n"
        )


def main():
    if len(sys.argv) > 1:
        if sys.argv[1].lower() == "test":
            # We dont want argument to be read by test runner.
            unittest.main(argv=["first-arg-is-ignored"], verbosity=2)
        elif sys.argv[1].lower() == "exec":
            if "--scale" in sys.argv:
                    hub_cmd_start_index= sys.argv.index("--scale")
                    hub_arg = int(sys.argv[hub_cmd_start_index+1])

                    # Define Hubs but defaults to node command
            else:
                hub_cmd_start_index= len(sys.argv)
                hub_arg =1
            if "--node-command" in sys.argv:
                node_cmd_start_index = sys.argv.index("--node-command")
                node_arg = ' '.join(sys.argv[node_cmd_start_index+1: hub_cmd_start_index])
            else:
                node_arg = "npm run watch"
            # Run arguments for cargo not provided.
            if len(sys.argv) < 3:
                print("ERROR: Cargo command is required\n")
                cli_error_message()
            else:
                if sys.argv[2].lower() == "--cargo-disabled":
                    None
                    main_runner(None,node_arg,hub_arg)
                else:
                    if sys.argv[2].lower() == "--cargo-enabled":
                        if len(sys.argv) < 4:
                            print("ERROR: Cargo arguments not provided\n")
                            cli_error_message()
                        else:
                            # Arguments after cargo-enabled should not be split by the argparse of python.
                            cargo_cmd_start_index= sys.argv.index("--cargo-enabled")
                            cargo_arg = ' '.join(sys.argv[cargo_cmd_start_index+1:hub_cmd_start_index])
                            cargo_argument_len =  len(cargo_arg.split(' '))
                            # Run with default node-arguments
                            main_runner(cargo_arg, node_arg, hub_arg)
        else:
           print("ERROR:Incorrect main command given\n")
           cli_error_message()
    # Default behavior in case of no argument supplied i.e., run main
    else:
        cli_error_message()



# Starting point for building pubhub testing infrastructure
def main_runner(cargo_setup:str, node_arg:str, hubs:int = 1) -> None:

    initialization()

    # Starting port in series for matrix server (hub) and client
    matrix_port = 8008
    client_port = 8801

    num_of_hubs = hubs

    # Check all dependencies for the given project and run pubhubs server and build the pubhubs infrastructure
    dep_list = ["cargo", "cargo-watch", "npm", "docker", "sass" ]
    dep_status_dict = check_project_dependencies(dep_list)

    # All dependencies should be installed. In dictionary, values are status of package
    if not all(dep_status_dict.values()):
        proper_status = {k: ("Installed" if v else "Uninstalled") for k, v in dep_status_dict.items()}
        print_status(proper_status)
        sys.exit("-----Missing dependency----\nPubhubs build will now terminate with failure.")

    # Additional check for docker and docker compose because they could be installed but not running.
    print(f"\033[92mdocker ps\033[0m")
    subprocess.check_output(["docker", "ps"])

    docker_version_info = subprocess.run(["docker", "-v"], capture_output=True, text=True)

    # Getting only the version number of docker you are using.
    current_version= re.findall(r'\d+', docker_version_info.stdout)[0]
    print(f"\033[92mDocker version you are using is --- {current_version}\033[0m")

    if int(current_version) < DOCKER_VERSION:
        print(f"\x1b[1;33mWARNING: Docker version you are using is old. There will be some issues in running the script\x1b[0m")
        print(f"\x1b[1;33m The script will terminate..\x1b[0m")
        exit(-1)

    print(f"\033[92mdocker compose\033[0m")
    subprocess.check_output(["docker", "compose"])

    # Building Yivi
    os.chdir("docker_yivi")
    run_docker_compose()
    os.chdir(root_dir)


    # Run global client first
    os.chdir("global-client")
    subprocess.run([*NPM, "install"], check=True)
    global_client_proces = Process(target=os.system, args=("npm run watch",))
    global_client_proces.start()


    # Run server in another process so that we can keep this script continue executing.
    os.chdir(root_dir)
    os.chdir("pubhubs")
    process_pubhub_server = Process(target=run_external_command, args=(cargo_setup,))
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


    # Build the test hub images
    #os.chdir("pubhubs_hub")
    build_test_hub_image("testhub", "pubhubs_hub/Dockerfile")
    #os.chdir(root_dir)
    os.chdir("hub-client")
    build_test_hub_image("testclient")
    os.chdir(root_dir)

    # Create test Hubs
    for i in range(num_of_hubs):

        hub_name = "testhub" + str(i)

        hub_id = create_test_pub_hub(url, hub_name, matrix_port, client_port)

        # Get html page with oidc id and secret
        oidc_page_html = get_odic_secret_info(hub_id, url)

        # Get a tuple container client id and client password
        oidc_secret = get_oidc_id_secret(oidc_page_html)

        client_id = oidc_secret[0]
        client_password = oidc_secret[1]

        hub_secret = export_hub_secret(hub_id, url)

        # Make the data dir for this hub server
        hub_data_dir = os.path.abspath(f'pubhubs_hub/{hub_name}')
        os.makedirs(hub_data_dir, exist_ok=True)

        # Copy the config files that do not need any changes
        for f in ['test_hub.log.config',
                  'testhub.signing.key']:
            shutil.copyfile(os.path.join('pubhubs_hub/matrix_test_config', f),
                            os.path.join(hub_data_dir, f))
        shutil.copytree('pubhubs_hub/matrix_test_config/templates',
                        os.path.join(hub_data_dir, 'templates'),
                        dirs_exist_ok=True)

        # Create homeserver file with new client id and password, and other import ports
        homeserver_path = os.path.join(hub_data_dir, 'homeserver.yaml')
        update_homeserver_yaml(get_homeserver_path(), homeserver_path,
                               client_id, client_password, client_port, matrix_port)

        # Change permissions of relevant matrix config directory
        matrix_config_list = [
            ".",
            "homeserver.yaml",
            "test_hub.log.config",
            "testhub.signing.key",
        ]
        matrix_config_permission_change([os.path.join(hub_data_dir, f) for f in matrix_config_list])

        # Run the hub server
        os.chdir("pubhubs_hub")
        container_name = f"{hub_name}_{matrix_port}"
        remove_container(container_name)
        docker_run_hub_server(hub_secret, "testhub", container_name, matrix_port, hub_data_dir)
        os.chdir(root_dir)

        # Hub Client

        client_name = "testclient" + str(i)

        os.chdir("hub-client")
        container_name = f"{client_name}_{client_port}"
        remove_container(container_name)
        docker_run_hub_client("testclient", i, container_name, client_port, matrix_port)
        os.chdir(root_dir)

        # Update the ports in sequence
        matrix_port = matrix_port + 1
        client_port = client_port + 1

    print ("<< Message>>> Development setup is ready to run. Please follow the instructions in the README of the project.")

    if (os.getenv('WATCH_MODULES') != '1'):
        print("\n"
              "Tip: if you are working on the Synapse PubHubs modules, use\n"
              "\n"
              "  WATCH_MODULES=1 python3 start_test_setup.py exec --cargo-disabled\n"
              "\n"
              "to mount the modules as volume.\n")
    else:
        print("\n"
              "Don't forget to start synapse manually (and restart it after any changes to its modules):\n"
              "\n"
              "  docker exec -it testhub0_8008  ./start.py\n")

    post_processing()
    # process_global_client.join()
    # process_pubhub_server.join()



## TEST SECTION ##
import unittest
import re
from unittest import mock
from unittest.mock import MagicMock, patch
from threading import Thread
import io
from contextlib import redirect_stdout
from http.server import BaseHTTPRequestHandler, HTTPServer
import socket
import tempfile

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
    def test_run_external_command(self, os_system):
        cargo_arg = "cargo watch --watch-when-idle -x run"
        run_external_command(cargo_arg)
        os_system.assert_called_once_with("cargo watch --watch-when-idle -x run")

    # HTTP endpoint related unit tests.
    def test_check_server_status(self):
        url = "http://localhost:{port}".format(port=self.mock_server_port)
        response = check_server_status(url)
        # We will get a response as a dictionary.
        assert isinstance(response, dict)

    def test_create_test_pub_hub(self):
        url = "http://localhost:{port}".format(port=self.mock_server_port)
        response = create_test_pub_hub(url, "testhub", 8001,8088)
        pattern = "[a-zA-Z0-9]+-[a-zA-Z0-9]+-[a-zA-Z0-9]+-[a-zA-Z0-9]+-[a-zA-Z0-9]+"
        self.assertRegex(response, re.compile(pattern))

    def test_export_hub_secret(self):
        url = "http://localhost:{port}".format(port=self.mock_server_port)

        ## How secrets are generated in Pubhubs. Is there a relationship between hubid and response
        response = export_hub_secret("1234", url)
        pattern = "[a-zA-Z0-9]{64}"
        self.assertRegex(response, re.compile(pattern))


    def test_get_homeserver_path(self):
        # Set up the test
        root_dir = os.path.dirname(os.path.abspath(__file__))
        default_path = "pubhubs_hub/matrix_test_config"
        expected_file_path = os.path.join(root_dir, default_path, "homeserver.yaml")

        # Call the method
        actual_file_path = get_homeserver_path()

        # Assert the file path is as expected
        self.assertEqual(actual_file_path, expected_file_path)

    def test_get_homeserver_path_with_custom_path(self):
        # Set up the test
        root_dir = os.path.dirname(os.path.abspath(__file__))
        custom_path = "custom_hub/matrix_custom_config/"
        expected_file_path = os.path.join(root_dir, os.path.dirname(custom_path), "homeserver.yaml")

        # Call the method
        actual_file_path = get_homeserver_path(custom_path)

        # Assert the file path is as expected
        self.assertEqual(actual_file_path, expected_file_path)

    def test_remove_container(self):
        container_name = "test_container"

        # Mock the run_command function to simulate a running container
        run_command_mock = MagicMock(side_effect=[(container_name, None), (None, None), (None, None)])

        with patch(f"{__name__}.run_command", run_command_mock):
            remove_container(container_name)
            run_command_mock.assert_any_call(["docker", "ps", "-a", "--filter", f"name={container_name}", "--format", "{{.Names}}"])
            run_command_mock.assert_any_call(["docker", "stop", container_name])
            run_command_mock.assert_any_call(["docker", "rm", container_name])

    def test_remove_container_not_running(self):
        container_name = "test_container"

        # Mock the run_command function to simulate a non-existent container
        run_command_mock = MagicMock(side_effect=[("", None)])

        with patch(f'{__name__}.run_command', run_command_mock):
            remove_container(container_name)
            run_command_mock.assert_called_once_with(["docker", "ps", "-a", "--filter", f"name={container_name}", "--format", "{{.Names}}"])


    def test_update_homeserver_yaml(self):
            # Sample content for the homeserver.yaml file
        content = """\
client_id: old_client_id
client_secret: old_client_secret
client_url: "http://localhost:8080"
public_baseurl: "http://localhost:8080"
- port: 8080
"""

        # New values to update the homeserver.yaml file
        new_client_id = 'new_client_id'
        new_client_secret = 'new_client_secret'
        new_client_port = 9090
        new_hub_port = 9009

        # Create a temporary file and write the sample content to it
        with tempfile.NamedTemporaryFile(mode='w+', delete=False) as temp_file:
            temp_file.write(content)
            temp_file_path = temp_file.name

        try:
            # Call the update_homeserver_yaml function to update the content
            update_homeserver_yaml(temp_file_path, temp_file_path, new_client_id, new_client_secret, new_client_port, new_hub_port)

            # Read the updated content and assert that it's correct
            with open(temp_file_path, 'r') as updated_file:
                updated_content = updated_file.read()

            expected_content = f"""\
client_id: {new_client_id}
client_secret: {new_client_secret}
client_url: "http://localhost:{new_client_port}",
public_baseurl: "http://localhost:{new_hub_port}"
- port: {new_hub_port}
"""

            self.assertEqual(updated_content, expected_content)

        finally:
            # Clean up the temporary file
            os.remove(temp_file_path)


## MAIN SECTION ##
if __name__ == "__main__":
    main()

