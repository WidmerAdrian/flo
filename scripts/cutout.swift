// Cuts the person out of a photo with Apple's Vision framework (on-device, macOS 14+) and writes a PNG with
// transparency. The mask is pulled in by `choke` pixels and softened, so no fringe of the old background stays.
// Usage: swift scripts/cutout.swift <in.jpg> <out.png> [choke, default 2]
import Foundation
import Vision
import CoreImage
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count >= 3 else { print("usage: cutout <in> <out.png> [choke]"); exit(2) }
let input = URL(fileURLWithPath: args[1]), output = URL(fileURLWithPath: args[2])
let choke = args.count > 3 ? Double(args[3]) ?? 2 : 2
guard let src = CGImageSourceCreateWithURL(input as CFURL, nil), let cg = CGImageSourceCreateImageAtIndex(src, 0, nil) else { print("cannot read"); exit(1) }

let handler = VNImageRequestHandler(cgImage: cg)
let request = VNGenerateForegroundInstanceMaskRequest()
try handler.perform([request])
guard let result = request.results?.first else { print("no foreground found"); exit(1) }
let maskBuffer = try result.generateScaledMaskForImage(forInstances: result.allInstances, from: handler)
let photo = CIImage(cgImage: cg)
var mask = CIImage(cvPixelBuffer: maskBuffer)
if choke > 0 {
  mask = mask.applyingFilter("CIMorphologyMinimum", parameters: ["inputRadius": choke]).cropped(to: photo.extent)
  mask = mask.applyingGaussianBlur(sigma: choke * 0.6).cropped(to: photo.extent)
}
let cut = photo.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: CIImage.empty(), kCIInputMaskImageKey: mask])
let ctx = CIContext()
guard let out = ctx.createCGImage(cut, from: photo.extent),
      let dest = CGImageDestinationCreateWithURL(output as CFURL, UTType.png.identifier as CFString, 1, nil) else { print("cannot write"); exit(1) }
CGImageDestinationAddImage(dest, out, nil)
CGImageDestinationFinalize(dest)
print("ok", result.allInstances.count, "instance(s)", out.width, "x", out.height, "choke", choke)
