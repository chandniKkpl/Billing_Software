import os
import stat

path = '/Users/aayushyadav/loha-store'
try:
    st = os.stat(path)
    print(f"Mode: {stat.filemode(st.st_mode)}")
    print(f"UID: {st.st_uid}, GID: {st.st_gid}")
except Exception as e:
    print(f"Error: {e}")
