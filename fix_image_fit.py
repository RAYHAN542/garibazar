with open("src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

old = '''              <img
                src={vehicleBannerImg}
                className="w-full h-20 object-cover object-center rounded-xl mt-auto"
                alt=""
              />'''

new = '''              <img
                src={vehicleBannerImg}
                className="w-full h-20 object-contain object-bottom mt-auto"
                alt=""
              />'''

if new in content:
    print("ALREADY DONE: image fit already fixed")
elif old in content:
    content = content.replace(old, new)
    with open("src/App.tsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("OK: image fit changed to object-contain (no more cropping)")
else:
    print("ERROR: pattern not found")
