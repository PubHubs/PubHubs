#!/usr/bin/env python3
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
import shutil
# Parsing arguments
import argparse

## GLOBAL SECTION ##
server = "http://localhost"

port = "8080"

root_dir = os.getcwd()

# These paths are used for intialization and post-processing. See the two methods intialization and post-processing
paths = [('/hub-client/public/','client-config.js'), ('/pubhubs_hub/matrix_test_config/','homeserver.yaml')]

## METHOD SECTION ##

# 
def get_homeserver_path(path:str ='/pubhubs_hub/matrix_test_config/') -> str:
    """ Get homeserver file path

    Args:
        path (str, optional): _description_. Defaults to '/pubhubs_hub/matrix_test_config/'.

    Returns:
        path(str): Returns the homeserver file path.
    """
    
    dir_path = os.path.dirname(root_dir +path)
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
    client_id_pattern = r'OpenID Connect Client ID:</dt>\n\s+<dd>(.*?)</dd>'
    client_password_pattern = r'OpenID Connect Client Password:</dt>\n\s+<dd>(.*?)</dd>'
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

def build_test_hub_image(image_name):
    
    """
    Build a Docker image with the specified name.

    Args:
        image_name (str): The name of the Docker image to build.

    Returns:
        None
    """
    
    docker_build_command = "docker build -t " +  image_name + " ."
    print(f"\033[92m{docker_build_command}\033[0m")
    subprocess.call(docker_build_command, shell=True)

def docker_run_hub(env_value, image_name, client_port, hub_port):
    
    """
    Run a Docker container using the specified image and environment variables.

    Args:
        env_value (str): The value of the HUB_SECRET environment variable.
        image_name (str): The name of the Docker image to use.
        client_port (str): The port to use for the client.
        matrix_port (str): The port to use for the each Hub.

    Returns:
        None
    """
    
    if "testclient" in image_name:
        docker_command = f""" docker run --name {image_name}_{client_port} -e PORT={client_port}  -e 'BAR_URL=frame-ancestors http://localhost:8080' -e 'HUB_URL=http://localhost:{hub_port}' -e 'PARENT_URL=http://localhost:8080' -d -p {client_port}:8800 {image_name} """
    else:            
        docker_command =  f"docker run --name {image_name}_{hub_port} -d -p {hub_port}:{hub_port} -e HUB_SECRET={env_value} \
           -e SYNAPSE_CONFIG_DIR=/data \
           -e AUTHLIB_INSECURE_TRANSPORT=for_testing_only_of_course \
           -v {os.getcwd()}/matrix_test_config:/data:rw \
           --add-host host.docker.internal:host-gateway \
           {image_name}"
   
    
    subprocess.call(docker_command, shell=True)

def run_docker_compose(env_value=None, args: str = None) -> None:
    
    """
    Start the services defined in a Docker Compose file.

    Args:
        env_value (str): The value of the HUB_SECRET environment variable.
        args (str): Additional arguments to pass to the `docker compose up` command.

    Returns:
        None
    """
    
    docker_command = "docker compose up -d"

    if args is not None:
        docker_command += args

    print(f"\033[92m{docker_command}\033[0m")
    subprocess.call(docker_command, shell=True)


def update_homeserver_yaml(file_path, client_id, client_secret,client_port, hub_port):
      
    """
    Update the homeserver.yaml file with the specified client ID, client secret, and client URL.

    Args:
        file_path (str): The path to the homeserver.yaml file.
        client_id (str): The new client ID to use.
        client_secret (str): The new client secret to use.
        client_port (int): The port number to use for the client.

    Returns:
        None
    """
  
    with open(file_path, 'r+') as f:
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
        # Move the file pointer to the beginning of the file
        f.seek(0)

        # Write the updated content back to the file
        f.writelines(lines)

        # Truncate the file to the new length (in case the new content is shorter)
        f.truncate()

def update_client_config_file(hub_port):
    
    path = paths[0][0]
    file_name = paths[0][1]
    dir_path = os.path.dirname(root_dir + path)
    file_path = os.path.join(dir_path,file_name)
    
    
    
    
    """
    Update the config file for hub by specifying each hub port

    Args:
        file_path (str): The path to the .env file.
        hub_port (int): The port number to use for the client.
       
    Returns:
        None
    """
    
    with open(file_path, 'r+') as f:
        # Read the file content
        lines = f.readlines()
        for i, line in enumerate(lines):
            # Check if the line starts with 'client_id:' or 'client_secret:'
            if line.strip().startswith('HUB_URL:'):
                # Get the whitespace before the key
                whitespace = line[:-len(line.lstrip())]
                if line.strip().startswith('HUB_URL:'):
                    lines[i] = f'{whitespace}HUB_URL: "http://localhost:{hub_port}",\n'
                    
        # Move the file pointer to the beginning of the file
        f.seek(0)

        # Write the updated content back to the file
        f.writelines(lines)

        # Truncate the file to the new length (in case the new content is shorter)
        f.truncate()


def initialization():
    """
    Initializes the setup for the script such as creting backup files and modifying some files.

    Args:
        None

    Returns:
        None
    """
    # Create Temporary files
    create_temporary_files()
    
    
    

    # 


def post_processing():
    """
    Resets the state of the project i.e., removes any modified files and restors back to original files.

    Args:
        None

    Returns:
        None
    """
    for path, file_name in paths:
        dir_path = os.path.dirname(root_dir + path)
        file_path = os.path.join(dir_path,file_name)
        original_file = file_path
        bk_file = original_file + ".bk"
        shutil.copyfile(bk_file, original_file)
        if os.path.exists(bk_file):
            os.remove(bk_file)


def create_temporary_files():
    
    for path, file_name in paths:
        
        dir_path = os.path.dirname(root_dir + path)
        
        # path to the file you want to create a temporary copy of
        file_path = os.path.join(dir_path,file_name)
        
        original_file = file_path
        
        bk_file = original_file + ".bk"
        
        # IF the script is stop voluntarily.
        if os.path.exists(bk_file):
            
            if os.path.exists(original_file):
               
                os.remove(original_file)
            
            os.rename(bk_file,original_file)
        
        # create a temporary file with the same name as the original file    
        shutil.copyfile(original_file, bk_file)


def run_command(cmd):
    
    """
    Run the specified command in a subprocess and capture its stdout and stderr output.

    Args:
        cmd (str): The command to run.

    Returns:
        A tuple containing the stdout and stderr output from the subprocess.
    """
    
    print(f"\033[92m{cmd}\033[0m")
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, shell=True)
    return result.stdout.strip(), result.stderr.strip()


def remove_container(container_name):
    
    """
    Stop and remove the specified Docker container, if it is running or exists.

    Args:
        container_name (str): The name of the container to remove.

    Returns:
        None
    """
    
    cmd = f"assert_any_call(f"docker ps -a --filter 'name={container_name}' --format '{{{{.Names}}}}'")
            run_command_mock.assert_any_call(f"docker stop {container_name}")
            run_command_mock.assert_any_call(f"docker rm {container_name}")

    def test_remove_container_not_running(self):
        container_name = "test_container"

        # Mock the run_command function to simulate a non-existent container
        run_command_mock = MagicMock(side_effect=[("", None)])

        with patch(f'{__name__}.run_command', run_command_mock):
            remove_container(container_name)
            run_command_mock.assert_called_once_with(f"docker ps -a --filter 'name={container_name}' --format '{{{{.Names}}}}'")


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
            update_homeserver_yaml(temp_file_path, new_client_id, new_client_secret, new_client_port, new_hub_port)

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

