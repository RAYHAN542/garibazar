package shop.garibazar.twa;

import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import okhttp3.Dns;
import okhttp3.HttpUrl;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.dnsoverhttps.DnsOverHttps;

/**
 * Some Bangladeshi mobile networks (e.g. Robi) have DNS resolvers that fail
 * for certain domains. WebView fetch() always uses the phone's DNS, so this
 * plugin performs the HTTP request natively: system DNS first, and if that
 * fails, DNS-over-HTTPS via Cloudflare / Google (bootstrapped by fixed IPs).
 * TLS still verifies the real hostname. Only allow-listed hosts are served.
 */
@CapacitorPlugin(name = "DohHttp")
public class DohHttpPlugin extends Plugin {

    private static final Set<String> ALLOWED_HOSTS = new HashSet<>(Arrays.asList(
            "garibazar.shop",
            "www.garibazar.shop",
            "opppnxkrnhyzjzbbiity.supabase.co"
    ));

    private final ExecutorService executor = Executors.newFixedThreadPool(4);
    private OkHttpClient client;

    @Override
    public void load() {
        OkHttpClient bootstrap = new OkHttpClient.Builder()
                .connectTimeout(8, TimeUnit.SECONDS)
                .readTimeout(8, TimeUnit.SECONDS)
                .build();

        final Dns cloudflare = buildDoh(bootstrap, "https://1.1.1.1/dns-query", "1.1.1.1", "1.0.0.1");
        final Dns google = buildDoh(bootstrap, "https://dns.google/dns-query", "8.8.8.8", "8.8.4.4");

        Dns fallbackDns = hostname -> {
            try {
                List<InetAddress> r = Dns.SYSTEM.lookup(hostname);
                if (!r.isEmpty()) return r;
            } catch (UnknownHostException ignored) { }
            try {
                return cloudflare.lookup(hostname);
            } catch (UnknownHostException e) {
                return google.lookup(hostname);
            }
        };

        client = bootstrap.newBuilder()
                .dns(fallbackDns)
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(60, TimeUnit.SECONDS)
                .build();
    }

    private static Dns buildDoh(OkHttpClient base, String url, String ip1, String ip2) {
        try {
            return new DnsOverHttps.Builder()
                    .client(base)
                    .url(HttpUrl.get(url))
                    .bootstrapDnsHosts(InetAddress.getByName(ip1), InetAddress.getByName(ip2))
                    .build();
        } catch (UnknownHostException e) {
            return Dns.SYSTEM;
        }
    }

    @PluginMethod
    public void request(final PluginCall call) {
        executor.execute(() -> {
            try {
                String url = call.getString("url");
                String method = call.getString("method", "GET").toUpperCase();
                HttpUrl parsed = url == null ? null : HttpUrl.parse(url);
                if (parsed == null || !"https".equals(parsed.scheme()) || !ALLOWED_HOSTS.contains(parsed.host())) {
                    call.reject("Host not allowed");
                    return;
                }

                Request.Builder rb = new Request.Builder().url(parsed);
                String contentType = null;
                JSObject headers = call.getObject("headers", new JSObject());
                Iterator<String> keys = headers.keys();
                while (keys.hasNext()) {
                    String k = keys.next();
                    String v = headers.getString(k);
                    if (v == null) continue;
                    if (k.equalsIgnoreCase("content-type")) contentType = v;
                    rb.header(k, v);
                }

                String bodyB64 = call.getString("body");
                RequestBody body = null;
                if (bodyB64 != null) {
                    byte[] bytes = Base64.decode(bodyB64, Base64.NO_WRAP);
                    body = RequestBody.create(bytes, contentType != null ? MediaType.parse(contentType) : null);
                } else if (method.equals("POST") || method.equals("PUT") || method.equals("PATCH")) {
                    body = RequestBody.create(new byte[0], null);
                }
                rb.method(method, body);

                try (Response resp = client.newCall(rb.build()).execute()) {
                    JSObject out = new JSObject();
                    out.put("status", resp.code());
                    JSObject rh = new JSObject();
                    for (String name : resp.headers().names()) {
                        rh.put(name, resp.header(name));
                    }
                    out.put("headers", rh);
                    byte[] data = resp.body() != null ? resp.body().bytes() : new byte[0];
                    out.put("body", Base64.encodeToString(data, Base64.NO_WRAP));
                    call.resolve(out);
                }
            } catch (Exception e) {
                call.reject("Network error: " + e.getMessage());
            }
        });
    }
}
