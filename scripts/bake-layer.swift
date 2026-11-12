// Bakes what CSS would otherwise compute every frame into a cut-out image: a fade to transparent towards the
// bottom and a colour adjustment. A plain image moves on the GPU for free; a masked, filtered one is redrawn.
// Usage: swift scripts/bake-layer.swift <in.png> <out.png> <fadeFrom 0..1> <fadeTo 0..1> [saturation=1] [brightness=1] [crop x,y,w,h from top-left]
import Foundation
import CoreImage
import ImageIO
import UniformTypeIdentifiers

let a = CommandLine.arguments
guard a.count >= 5, let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: a[1]) as CFURL, nil),
      let cg = CGImageSourceCreateImageAtIndex(src, 0, nil) else { print("usage: bake-layer <in> <out> <from> <to> [sat] [bright] [x,y,w,h]"); exit(2) }
let from = Double(a[3])!, to = Double(a[4])!, sat = a.count > 5 ? Double(a[5])! : 1, bright = a.count > 6 ? Double(a[6])! : 1
var img = CIImage(cgImage: cg)
if a.count > 7 { // crop, given from the top-left as image editors count
  let c = a[7].split(separator: ",").map { Double($0)! }, h = img.extent.height
  img = img.cropped(to: CGRect(x: c[0], y: h - c[1] - c[3], width: c[2], height: c[3]))
  img = img.transformed(by: CGAffineTransform(translationX: -c[0], y: -(h - c[1] - c[3])))
}
let e = img.extent
img = img.applyingFilter("CIColorControls", parameters: [kCIInputSaturationKey: sat])
img = img.applyingFilter("CIColorMatrix", parameters: ["inputRVector": CIVector(x: bright, y: 0, z: 0, w: 0), "inputGVector": CIVector(x: 0, y: bright, z: 0, w: 0), "inputBVector": CIVector(x: 0, y: 0, z: bright, w: 0)])
// opaque above `from`, transparent below `to` (fractions of the height from the top)
let mask = CIFilter(name: "CILinearGradient", parameters: [
  "inputPoint0": CIVector(x: 0, y: e.height * (1 - from)), "inputColor0": CIColor.white,
  "inputPoint1": CIVector(x: 0, y: e.height * (1 - to)), "inputColor1": CIColor.black])!.outputImage!.cropped(to: e)
img = img.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: CIImage.empty(), kCIInputMaskImageKey: mask])
let ctx = CIContext()
guard let out = ctx.createCGImage(img, from: e), let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: a[2]) as CFURL, UTType.png.identifier as CFString, 1, nil) else { exit(1) }
CGImageDestinationAddImage(dest, out, nil); CGImageDestinationFinalize(dest)
print("ok", out.width, "x", out.height)
