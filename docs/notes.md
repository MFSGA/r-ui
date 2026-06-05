# Notes

## Todo

1. 添加更多的分享链接然后手动编辑

## WireGuard 示例

```ini
[Interface]
Address = 10.66.66.1/24
ListenPort = 51820
PrivateKey = 0MjxLNqD7JcG+h+emxT8/RM6Gs7bpwgeBvypp1JilXY=

PostUp = iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 18888 -j DNAT --to-destination 10.66.66.2:18888
PostUp = iptables -A FORWARD -i eth0 -o %i -p tcp -d 10.66.66.2 --dport 18888 -j ACCEPT
PostUp = iptables -A FORWARD -i %i -o eth0 -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
PostUp = iptables -t nat -A POSTROUTING -o %i -p tcp -d 10.66.66.2 --dport 18888 -j SNAT --to-source 10.66.66.1

PostDown = iptables -t nat -D PREROUTING -i eth0 -p tcp --dport 18888 -j DNAT --to-destination 10.66.66.2:18888
PostDown = iptables -D FORWARD -i eth0 -o %i -p tcp -d 10.66.66.2 --dport 18888 -j ACCEPT
PostDown = iptables -D FORWARD -i %i -o eth0 -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
PostDown = iptables -t nat -D POSTROUTING -o %i -p tcp -d 10.66.66.2 --dport 18888 -j SNAT --to-source 10.66.66.1

[Peer]
PublicKey = ju3U47Fw82wbQBOqRfPBS686dedcUVlFaVZzgo1ORmE=
AllowedIPs = 10.66.66.2/32
```

注意：node 进程被手动关闭过。
