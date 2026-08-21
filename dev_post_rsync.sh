# local_dir="/home/developer/Descargas/cashflow/"
local_dir="/home/kitty/Documents/Prod/turnos/"
server_user="developer"
server_ip="104.248.230.126"
server_dir="/home/developer/shiftControl/"

origin="$local_dir"
destination="$server_user@$server_ip:$server_dir"

rsync -cizP --recursive --delete --exclude-from='excludePatterns' "$origin" "$destination"