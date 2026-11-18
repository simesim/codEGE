from ipaddress import *
net = ip_network('192.168.1.100/24', 0)
k = 0
for ip in net:
    s = f'{int(ip):032b}'
    if s.count('1') == 16:
        k += 1
print(k)