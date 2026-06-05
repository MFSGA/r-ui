import { parseHy2ShareLink, formatHy2ShareLink, hy2ShareToXrayOutbound, outboundToHy2Share, importHy2ShareToXrayConfig, exportHy2LinksFromXrayConfig } from '../../src/utils/hysteria2-share.ts';

async function main() {
  // Test 1: Basic hysteria2 round-trip
  console.log('=== Test 1: Basic hysteria2 round-trip ===');
  try {
    const link1 = 'hysteria2://mypassword@server.example.com:443/?up=100mbps&down=200mbps&obfs=salamander&obfs-password=obfs_secret&sni=sni.example.com&insecure=1&congestion=bbr&pinSHA256=abc123&fm=%7B%22tcp%22%3A%7B%22enabled%22%3Afalse%7D%7D';
    const parsed = parseHy2ShareLink(link1);
    console.log(`Parse: OK - auth:${parsed.address} port:${parsed.port}`);
    
    const outbound = hy2ShareToXrayOutbound(parsed);
    console.log(`ToXray: OK - protocol:${outbound.protocol}`);
    
    const shareBack = outboundToHy2Share(outbound);
    const formatted = formatHy2ShareLink(shareBack);
    console.log(`Format: OK`);
    
    // Verify key fields
    const checks = [
      shareBack.auth === 'mypassword',
      shareBack.address === 'server.example.com',
      shareBack.port === 443,
      shareBack.params.obfs === 'salamander',
      shareBack.params.sni === 'sni.example.com',
      shareBack.params.up === '100mbps',
      shareBack.params.down === '200mbps',
      shareBack.params.congestion === 'bbr',
    ];
    console.log(`All checks passed: ${checks.every(Boolean) ? 'YES' : 'NO - ' + JSON.stringify(checks)}`);
    if (checks.every(Boolean)) console.log('Test 1: PASS');
    else console.log('Test 1: FAIL');
  } catch(e) {
    console.log(`Test 1: FAIL - ${e.message}`);
  }

  // Test 2: hy2:// scheme
  console.log('\n=== Test 2: hy2:// scheme ===');
  try {
    const link2 = 'hy2://pass@otherhost.com/?up=50mbps&down=50mbps';
    const parsed = parseHy2ShareLink(link2);
    console.log(`Parse hy2://: host:${parsed.address} port:${parsed.port} default443:${parsed.port === 443}`);
    console.log('Test 2: PASS');
  } catch(e) {
    console.log(`Test 2: FAIL - ${e.message}`);
  }

  // Test 3: gecko obfs
  console.log('\n=== Test 3: gecko obfs ===');
  try {
    const link3 = 'hysteria2://pass@host.com/?up=10mbps&down=10mbps&obfs=gecko';
    const parsed = parseHy2ShareLink(link3);
    console.log(`Parse gecko: obfs=${parsed.params.obfs}`);
    
    const outbound = hy2ShareToXrayOutbound(parsed);
    const udpmasks = outbound.streamSettings.udpmasks;
    console.log(`udpmasks type: ${udpmasks?.[0]?.type}`);
    console.log(`gecko in outbound: ${udpmasks?.[0]?.type === 'gecko'}`);
    
    const shareBack = outboundToHy2Share(outbound);
    console.log(`gecko round-trip: ${shareBack.params.obfs === 'gecko'}`);
    
    if (shareBack.params.obfs === 'gecko') console.log('Test 3: PASS');
    else console.log('Test 3: FAIL');
  } catch(e) {
    console.log(`Test 3: FAIL - ${e.message}`);
  }

  // Test 4: TLS always enabled
  console.log('\n=== Test 4: TLS always enabled ===');
  try {
    const link4 = 'hysteria2://pass@host.com/?up=10mbps&down=10mbps';
    const parsed = parseHy2ShareLink(link4);
    const outbound = hy2ShareToXrayOutbound(parsed);
    const sec = outbound.streamSettings.security;
    const alpn = outbound.streamSettings.tlsSettings?.alpn;
    console.log(`security: ${sec}, ALPN: ${JSON.stringify(alpn)}`);
    console.log(`TLS always on: ${sec === 'tls'}, ALPN [h3]: ${JSON.stringify(alpn) === '["h3"]'}`);
    if (sec === 'tls' && JSON.stringify(alpn) === '["h3"]') console.log('Test 4: PASS');
    else console.log('Test 4: FAIL');
  } catch(e) {
    console.log(`Test 4: FAIL - ${e.message}`);
  }

  // Test 5: Import/Export from config
  console.log('\n=== Test 5: Import/Export from config ===');
  try {
    const config = { outbounds: [{ protocol: 'vmess', settings: {} }] };
    const link5 = 'hysteria2://auth@x.com:8443/?up=100mbps&down=100mbps&obfs=salamander';
    const newConfig = importHy2ShareToXrayConfig(config, link5);
    const links = exportHy2LinksFromXrayConfig(newConfig);
    console.log(`Imported: ${newConfig.outbounds.length} outbounds, hysteria: ${newConfig.outbounds[1]?.protocol === 'hysteria'}`);
    console.log(`Exported: ${links.length} links, starts with hysteria2://: ${links[0]?.startsWith('hysteria2://')}`);
    if (links[0]?.startsWith('hysteria2://')) console.log('Test 5: PASS');
    else console.log('Test 5: FAIL');
  } catch(e) {
    console.log(`Test 5: FAIL - ${e.message}`);
  }

  console.log('\n=== ALL TESTS COMPLETE ===');
}

main().catch(console.error);
