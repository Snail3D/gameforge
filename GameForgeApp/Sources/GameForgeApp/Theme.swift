import SwiftUI

extension Color {
    static let forgeGreen = Color(red: 0, green: 1, blue: 0.533) // #00FF88
}

extension ShapeStyle where Self == Color {
    static var forgeGreen: Color { Color.forgeGreen }
}
