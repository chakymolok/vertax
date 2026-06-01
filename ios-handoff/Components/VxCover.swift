import SwiftUI

// MARK: - Generated record sleeve (deterministic from seed)
public struct VxCover: View {
    let seed: String
    var catalog: String? = nil
    var size: CGFloat = 52
    var radius: CGFloat = VxRadius.cover
    public init(seed: String, catalog: String? = nil, size: CGFloat = 52, radius: CGFloat = VxRadius.cover) {
        self.seed = seed; self.catalog = catalog; self.size = size; self.radius = radius
    }
    private static let tints: [(UInt, UInt)] = [
        (0x2B4A4D,0x9FDCE0),(0x3A3551,0xB9A8E6),(0x4A3C33,0xE6B78F),(0x324A37,0x9FE0A8),
        (0x3F3A44,0xCFC6D6),(0x2D3F4F,0x9CC6E6),(0x4A3340,0xE6A0C4),(0x43472D,0xD9DE8A),(0x33414A,0xA8CDD9)
    ]
    var pair: (UInt, UInt) {
        var h: UInt = 0; for u in seed.unicodeScalars { h = (h &* 31 &+ u.value) }
        return Self.tints[Int(h % UInt(Self.tints.count))]
    }
    public var body: some View {
        let (bg, disc) = pair
        ZStack {
            Color(rgb: bg)
            Circle().fill(Color(rgb: disc)).frame(width: size*0.36, height: size*0.36)
            Circle().fill(Color(rgb: 0x0C0F0E)).frame(width: size*0.10, height: size*0.10)
            if let catalog, size >= 44 {
                VStack { Spacer(); HStack { Text(catalog).font(.system(size: 8, weight: .regular, design: .monospaced)).foregroundStyle(.white.opacity(0.62)); Spacer() } }.padding(6)
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
    }
}
