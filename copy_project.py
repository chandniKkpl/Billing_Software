import os
import shutil

src = '/Users/aayushyadav/cosmo-store'
dst = '/Users/aayushyadav/cosmo-store/loha-store'
ignore_patterns = {'.git', 'node_modules', '.next', 'dev-dist', 'out', 'copy_project.py', 'inspect_dir.py', 'npm_home', 'npm_cache', 'loha-store'}

def copy_tree(src_dir, dst_dir):
    if not os.path.exists(dst_dir):
        os.makedirs(dst_dir)
    for item in os.listdir(src_dir):
        if item in ignore_patterns:
            continue
        src_path = os.path.join(src_dir, item)
        dst_path = os.path.join(dst_dir, item)
        if os.path.isdir(src_path):
            copy_tree(src_path, dst_path)
        else:
            with open(src_path, 'rb') as fsrc:
                with open(dst_path, 'wb') as fdst:
                    fdst.write(fsrc.read())

try:
    copy_tree(src, dst)
    print("SUCCESS: Copy completed successfully!")
except Exception as e:
    import traceback
    traceback.print_exc()
