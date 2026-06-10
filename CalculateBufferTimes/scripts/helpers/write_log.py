import os

def add_to_log(filename, text):
    # Ensure the file exists before attempting to write
    assert os.path.exists(filename), f"Error: {filename} does not exist."
    
    # Open in 'a' (append) mode to add text
    with open(filename, 'a') as file:
        file.write(text + '\n')

def initialize_logfile(filename):
    # Opening in 'w' (write) mode automatically creates the file if it 
    # doesn't exist, and truncates (clears) it if it does.
    with open(filename, 'w') as file:
        pass 